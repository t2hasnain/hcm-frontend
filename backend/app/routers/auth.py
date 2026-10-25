from typing import Any, Dict
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Employee, User
from app.schemas.auth import (
    AuthStatusResponse,
    ChangePasswordRequest,
    FirstRunRequest,
    LoginRequest,
    LoginResponse,
    RequestOTPRequest,
    VerifyOTPChangePasswordRequest,
)
from app.services.auth_service import (
    authenticate_user,
    change_user_password,
    check_is_initialized,
    execute_first_run,
    request_password_reset_otp,
    verify_otp_change_password,
)

router = APIRouter(prefix="/auth", tags=["M1: Authentication & Access"])


def extract_client_ip(request: Request) -> str:
    """Safely extracts real client IP addressing reverse proxies and local dev."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


@router.get(
    "/status",
    response_model=AuthStatusResponse,
    summary="Check System Initialization Status",
    description="Returns whether the primary Admin user and system have been initialized.",
)
def get_auth_status(db: Session = Depends(get_db)) -> AuthStatusResponse:
    initialized = check_is_initialized(db)
    return AuthStatusResponse(is_initialized=initialized)


@router.get(
    "/my-ip",
    summary="Get Client IP Address",
    description="Returns the calling client's detected IP address for configuring trusted IP rules.",
)
def get_client_ip(request: Request) -> Dict[str, str]:
    ip = extract_client_ip(request)
    return {"client_ip": ip}


@router.post(
    "/first-run",
    status_code=status.HTTP_201_CREATED,
    summary="First-Run Initial Setup",
    description="Executes initial setup. Only valid when 0 users exist. Creates CompanySettings and primary Admin.",
)
def first_run_setup(
    payload: FirstRunRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return execute_first_run(db, payload)


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="User Login",
    description="Authenticates credentials, verifies Trusted IP rules, and returns JWT bearer token.",
)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse:
    client_ip = extract_client_ip(request)
    return authenticate_user(db, payload, client_ip=client_ip)


@router.post(
    "/change-password",
    summary="Change Account Password (Method A: Current Password)",
    description="Updates the user password using Old Password + New Password. Subject to role-based 24h limits.",
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    return change_user_password(db, current_user, payload)


@router.post(
    "/request-otp",
    summary="Request 4-Digit Password Reset Code (Method B: Email OTP)",
    description="Sends a 4-digit verification code to the registered email. Enforces limits (Employees: 3/day, HR: 5/day).",
)
def request_otp(
    payload: RequestOTPRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return request_password_reset_otp(db, payload.email)


@router.post(
    "/verify-otp-change-password",
    summary="Verify 4-Digit Code & Update Password",
    description="Validates the 4-digit code and updates account password with max 3 attempts limit.",
)
def verify_otp_and_change_password(
    payload: VerifyOTPChangePasswordRequest,
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    return verify_otp_change_password(
        db=db,
        email=payload.email,
        otp_code=payload.otp_code,
        new_password=payload.new_password,
    )


@router.get(
    "/me",
    summary="Current User Profile",
    description="Returns the authenticated user details and linked employee identifier.",
)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "must_change_password": current_user.must_change_password,
        "created_at": current_user.created_at,
        "employee_id": emp.id if emp else None,
        "employee_code": emp.employee_code if emp else None,
        "full_name": emp.full_name if emp else None,
    }
