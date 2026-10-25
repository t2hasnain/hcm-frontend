import logging
from typing import Any, Callable, Dict, List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.models import Employee, User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates JWT Bearer token and returns the authenticated User instance.
    Raises 401 if missing, invalid, or expired.
    Raises 403 if user account is deactivated.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_sub = payload.get("sub")
    if not user_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Subject can be user_id (string) or email
    user: Optional[User] = None
    if str(user_sub).isdigit():
        user = db.query(User).filter(User.id == int(user_sub)).first()
    if not user:
        user = db.query(User).filter(User.email == str(user_sub)).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this token does not exist.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated. Contact HR or System Administrator.",
        )

    return user


class RoleChecker:
    """
    Reusable dependency for verifying user roles with strict RBAC enforcement.
    """

    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = [r.upper() for r in allowed_roles]

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        user_role = (current_user.role or "").upper()
        if user_role not in self.allowed_roles:
            logger.warning(
                "Access denied for user %s (role: %s). Required roles: %s",
                current_user.email,
                current_user.role,
                self.allowed_roles,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Insufficient permissions. Required role: {', '.join(self.allowed_roles)}",
            )
        return current_user


# Role-specific guards
require_admin = RoleChecker(["Admin"])
require_hr = RoleChecker(["HR"])
require_hr_or_admin = RoleChecker(["Admin", "HR"])
require_authenticated_user = get_current_user


def get_current_employee(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Optional[Employee]:
    """
    Returns the Employee profile linked to the current User, or None if user has no employee record.
    """
    return db.query(Employee).filter(Employee.user_id == current_user.id).first()


def enforce_employee_scope(
    target_employee_id: int,
    current_user: User,
    db: Session,
) -> Employee:
    """
    Strict Data-Scope Guard:
    - Admin and HR can access any employee record.
    - Employee can NEVER access another employee's record; if target_employee_id does not
      match their own employee profile, raises 403 Forbidden.
    """
    user_role = (current_user.role or "").capitalize()

    if user_role in ["Admin", "Hr"]:
        emp = db.query(Employee).filter(Employee.id == target_employee_id).first()
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {target_employee_id} not found.",
            )
        return emp

    # Current user is Employee role: strictly check linked profile
    current_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not current_emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile is associated with your user account.",
        )

    if current_emp.id != target_employee_id:
        logger.warning(
            "Data-scope violation: User %s (Employee ID: %s) attempted to access Employee ID %s",
            current_user.email,
            current_emp.id,
            target_employee_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to view or mutate another employee's record.",
        )

    return current_emp
