import logging
import secrets
import string
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.models import (
    AuditLog,
    CompanySettings,
    Employee,
    Notification,
    PasswordResetOTP,
    User,
)
from app.schemas.auth import (
    ChangePasswordRequest,
    FirstRunRequest,
    LoginRequest,
    LoginResponse,
)
from app.utils.audit_service import log_audit
from app.utils.email_service import (
    send_otp_verification_email,
    send_password_changed_confirmation_email,
)

logger = logging.getLogger(__name__)


def generate_secure_temporary_password(length: int = 12) -> str:
    """
    Generate a cryptographically secure temporary password meeting enterprise complexity rules.
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in password)
            and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password)
            and any(c in "!@#$%&*" for c in password)
        ):
            return password


def check_is_initialized(db: Session) -> bool:
    """
    Checks if system is already initialized with an active Admin account.
    """
    admin_count = db.query(User).filter(User.role == "Admin").count()
    return admin_count > 0


def execute_first_run(db: Session, payload: FirstRunRequest) -> Dict[str, Any]:
    """
    Executes first-run initial setup.
    Allowed only when the system has 0 registered users.
    Creates CompanySettings, primary Admin User (must_change_password=False),
    and logs the action in the immutable AuditLog.
    """
    total_users = db.query(User).count()
    if total_users > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="First-run initialization is locked because user accounts already exist.",
        )

    # 1. Initialize Company Settings
    company = CompanySettings(
        company_name=payload.company_name,
        logo_url=payload.logo_url,
        office_start_time=payload.office_start_time,
        grace_minutes=payload.grace_minutes,
        half_day_hours=payload.half_day_hours,
        weekend_days=payload.weekend_days,
        office_lat=payload.office_lat,
        office_lng=payload.office_lng,
        geofence_radius_m=payload.geofence_radius_m,
        annual_leave_quota=payload.annual_leave_quota,
        sick_leave_quota=payload.sick_leave_quota,
        casual_leave_quota=payload.casual_leave_quota,
    )
    db.add(company)
    db.flush()

    # 2. Create Primary Admin User
    admin_user = User(
        email=payload.admin_email.lower(),
        password_hash=get_password_hash(payload.admin_password),
        role="Admin",
        must_change_password=False,
        is_active=True,
    )
    db.add(admin_user)
    db.flush()

    # 3. Create linked Employee profile for Admin
    admin_employee = Employee(
        user_id=admin_user.id,
        employee_code="ADM-0001",
        full_name=payload.admin_name,
        phone=payload.admin_phone,
        joining_date=date.today(),
        status="Active",
        basic_salary=100000.0,
    )
    db.add(admin_employee)
    db.flush()

    # 4. Record Audit Log
    log_audit(
        db=db,
        actor_id=admin_user.id,
        action="FIRST_RUN_INITIALIZATION",
        entity="System",
        entity_id="init-1",
        before_json={"status": "uninitialized"},
        after_json={
            "admin_user_id": admin_user.id,
            "admin_email": admin_user.email,
            "company_name": company.company_name,
            "office_start_time": company.office_start_time,
        },
        commit=False,
    )

    db.commit()
    db.refresh(admin_user)
    db.refresh(admin_employee)

    # Generate access token for instant entry
    access_token = create_access_token(
        data={
            "sub": str(admin_user.id),
            "role": admin_user.role,
            "email": admin_user.email,
        }
    )

    logger.info("System successfully initialized by Admin: %s", admin_user.email)

    return {
        "message": "HCM Lite system initialized successfully.",
        "access_token": access_token,
        "token_type": "bearer",
        "role": admin_user.role,
        "user_id": admin_user.id,
        "email": admin_user.email,
        "employee_id": admin_employee.id,
        "company_name": company.company_name,
    }


def check_ip_allowed(user_role: str, client_ip: Optional[str], company: Optional[CompanySettings]) -> None:
    """
    Validates whether the incoming client IP address is permitted to log in under the target user's role.
    If IP restrictions are enabled and the role has configured IPs, client_ip must match.
    """
    if not company or not company.ip_restrictions_enabled:
        return
    if not client_ip:
        return

    norm_ip = client_ip.strip()

    # Determine allowed IP list based on user role
    allowed_list: List[str] = []
    if user_role == "Admin":
        allowed_list = company.admin_allowed_ips or []
    elif user_role == "HR":
        allowed_list = company.hr_allowed_ips or []
    elif user_role == "Employee":
        allowed_list = company.employee_allowed_ips or []

    if allowed_list:
        clean_allowed = [str(ip).strip() for ip in allowed_list if str(ip).strip()]
        if clean_allowed and norm_ip not in clean_allowed:
            logger.warning(
                "Access blocked: Client IP %s is not in trusted network list for role %s. Allowed: %s",
                norm_ip,
                user_role,
                clean_allowed,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Your network IP address ({norm_ip}) is not on the trusted network list for {user_role} accounts. Please connect through an authorized corporate network or contact your System Administrator.",
            )


def enforce_password_action_limit(db: Session, user: User, action_type: str = "password_change") -> None:
    """
    Enforces role-based limits on password reset and OTP requests:
    - Employees: Max 3 requests / changes per 24 hours
    - HR: Max 5 requests / changes per 24 hours
    - Admin: Unrestricted (up to 20)
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)

    if action_type == "password_change":
        recent_changes = (
            db.query(AuditLog)
            .filter(
                AuditLog.actor_id == user.id,
                AuditLog.action.in_(["CHANGE_PASSWORD", "CHANGE_PASSWORD_OTP"]),
                AuditLog.created_at >= since,
            )
            .count()
        )
        if user.role == "Employee" and recent_changes >= 3:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Security limit reached: Employees can change their password at most 3 times per 24 hours. Please contact HR administration if you require further assistance.",
            )
        elif user.role == "HR" and recent_changes >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Security limit reached: HR accounts can change their password at most 5 times per 24 hours.",
            )
    elif action_type == "otp_request":
        recent_otps = (
            db.query(PasswordResetOTP)
            .filter(
                PasswordResetOTP.user_id == user.id,
                PasswordResetOTP.created_at >= since,
            )
            .count()
        )
        if user.role == "Employee" and recent_otps >= 3:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Security limit reached: Employees can request up to 3 verification codes per 24 hours. Please check your existing email or contact HR administration.",
            )
        elif user.role == "HR" and recent_otps >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Security limit reached: HR accounts can request up to 5 verification codes per 24 hours.",
            )


def authenticate_user(
    db: Session,
    payload: LoginRequest,
    client_ip: Optional[str] = None,
) -> LoginResponse:
    """
    Authenticates user credentials, enforces Trusted IP restrictions, and issues a signed JWT access token.
    """
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        logger.warning("Failed login attempt for email: %s from IP %s", payload.email, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact your System Administrator.",
        )

    # Enforce Trusted IP Network Restriction
    company = db.query(CompanySettings).first()
    check_ip_allowed(user_role=user.role, client_ip=client_ip, company=company)

    emp = db.query(Employee).filter(Employee.user_id == user.id).first()

    token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role,
            "email": user.email,
        }
    )

    logger.info("Successful login for user %s (role: %s) from IP %s", user.email, user.role, client_ip)

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        must_change_password=user.must_change_password,
        user_id=user.id,
        email=user.email,
        employee_id=emp.id if emp else None,
        employee_code=emp.employee_code if emp else None,
        full_name=emp.full_name if emp else None,
    )


def change_user_password(
    db: Session,
    user: User,
    payload: ChangePasswordRequest,
) -> Dict[str, str]:
    """
    Updates the user's password using the Old Password + New Password method.
    Enforces 24-hour rate limits, dispatches email notification, and logs an audit entry.
    """
    # Enforce role limit
    enforce_password_action_limit(db, user, action_type="password_change")

    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The current password provided is incorrect.",
        )

    if payload.old_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The new password must be different from the old password.",
        )

    user.password_hash = get_password_hash(payload.new_password)
    user.must_change_password = False

    # In-app notification
    notif = Notification(
        user_id=user.id,
        title="Password Updated",
        message="Your account password was successfully updated using your current password.",
    )
    db.add(notif)

    log_audit(
        db=db,
        actor_id=user.id,
        action="CHANGE_PASSWORD",
        entity="User",
        entity_id=user.id,
        before_json={"must_change_password": True},
        after_json={"must_change_password": False},
        commit=False,
    )

    db.commit()

    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    user_name = emp.full_name if emp else user.email.split("@")[0]

    try:
        send_password_changed_confirmation_email(to_email=user.email, user_name=user_name)
    except Exception as e:
        logger.warning("Failed to send password change confirmation email: %s", e)

    logger.info("User %s successfully updated password.", user.email)
    return {"message": "Password changed successfully."}


def request_password_reset_otp(db: Session, email: str) -> Dict[str, Any]:
    """
    Generates a 4-digit verification code OTP and sends it to the user's email address.
    Enforces security rate limits per role (Employees: 3/day, HR: 5/day).
    """
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user:
        return {
            "message": "If an active account exists for this email address, a 4-digit verification code has been dispatched.",
            "email": email,
        }

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact your System Administrator.",
        )

    # Check 24-hour rate limit
    enforce_password_action_limit(db, user, action_type="otp_request")

    # Invalidate previous unused codes
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.user_id == user.id,
        PasswordResetOTP.is_used == False,
    ).update({"is_used": True})

    # Generate 4-digit code (e.g., 5821)
    code = f"{secrets.randbelow(9000) + 1000}"
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=10)

    otp = PasswordResetOTP(
        user_id=user.id,
        otp_code=code,
        expires_at=expires,
        attempts_count=0,
        is_used=False,
    )
    db.add(otp)
    db.commit()

    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    user_name = emp.full_name if emp else user.email.split("@")[0]

    try:
        send_otp_verification_email(
            to_email=user.email,
            user_name=user_name,
            otp_code=code,
            minutes_valid=10,
        )
    except Exception as e:
        logger.warning("Failed to send OTP verification email: %s", e)

    return {
        "message": "A 4-digit verification code has been dispatched to your email. The code is valid for 10 minutes.",
        "email": user.email,
    }


def verify_otp_change_password(
    db: Session,
    email: str,
    otp_code: str,
    new_password: str,
) -> Dict[str, str]:
    """
    Verifies 4-digit OTP code sent to user email and updates account password.
    Enforces max 3 attempts per OTP code, updates password, and dispatches confirmation email.
    """
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account with this email does not exist.",
        )

    now = datetime.now(timezone.utc)
    otp = (
        db.query(PasswordResetOTP)
        .filter(
            PasswordResetOTP.user_id == user.id,
            PasswordResetOTP.is_used == False,
            PasswordResetOTP.expires_at >= now,
        )
        .order_by(PasswordResetOTP.created_at.desc())
        .first()
    )

    if not otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code is invalid or has expired. Please request a new code.",
        )

    if otp.attempts_count >= 3:
        otp.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many invalid attempts. For security, this code has been invalidated. Please request a new code.",
        )

    if otp.otp_code.strip() != otp_code.strip():
        otp.attempts_count += 1
        db.commit()
        remaining = 3 - otp.attempts_count
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect 4-digit code. You have {remaining} attempt(s) remaining.",
        )

    # Valid OTP
    otp.is_used = True
    user.password_hash = get_password_hash(new_password)
    user.must_change_password = False

    notif = Notification(
        user_id=user.id,
        title="Password Updated",
        message="Your account password was updated successfully using 4-digit email verification.",
    )
    db.add(notif)

    log_audit(
        db=db,
        actor_id=user.id,
        action="CHANGE_PASSWORD_OTP",
        entity="User",
        entity_id=user.id,
        before_json={"method": "email_otp"},
        after_json={"status": "success"},
        commit=False,
    )

    db.commit()

    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    user_name = emp.full_name if emp else user.email.split("@")[0]

    try:
        send_password_changed_confirmation_email(to_email=user.email, user_name=user_name)
    except Exception as e:
        logger.warning("Failed to send password confirmation email: %s", e)

    return {"message": "Your password has been successfully updated. You can now log in with your new password."}
