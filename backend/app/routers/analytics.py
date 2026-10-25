from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, require_hr_or_admin
from app.models.models import User
from app.services.analytics_service import (
    get_admin_dashboard,
    get_employee_dashboard,
    get_hr_dashboard,
)

router = APIRouter(prefix="/analytics", tags=["M7: Dashboards & Analytics"])


@router.get("/admin")
def admin_dashboard(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Full admin KPI dashboard with headcount, attendance, payroll, and audit trail."""
    return get_admin_dashboard(db)


@router.get("/hr")
def hr_dashboard(
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """HR dashboard with leave and attendance metrics."""
    return get_hr_dashboard(db)


@router.get("/employee")
def employee_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Personal employee dashboard with attendance, leave, and notifications."""
    return get_employee_dashboard(db, current_user)
