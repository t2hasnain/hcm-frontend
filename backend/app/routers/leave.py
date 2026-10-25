from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_hr_or_admin
from app.models.models import Employee, User
from app.schemas.leave import (
    LeaveApplyRequest,
    LeaveBalanceResponse,
    LeaveDecisionRequest,
    LeaveListResponse,
    LeaveOut,
)
from app.services.leave_service import (
    apply_for_leave,
    cancel_leave_request,
    decide_leave_request,
    get_leave_balance,
    get_leaves_list,
)

router = APIRouter(prefix="/leave", tags=["M5: Leave Management"])


@router.post("/apply", response_model=LeaveOut, status_code=201)
def apply_leave(
    payload: LeaveApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Apply for a leave. Checks quota, overlaps, and working days."""
    return apply_for_leave(db, current_user, payload)


@router.get("/balance", response_model=LeaveBalanceResponse)
def get_my_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get leave balance for the currently authenticated employee."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No employee profile linked to your account.")
    return get_leave_balance(db, emp.id)


@router.get("/balance/{employee_id}", response_model=LeaveBalanceResponse)
def get_employee_balance(
    employee_id: int,
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """Get leave balance for a specific employee. HR/Admin only."""
    return get_leave_balance(db, employee_id)


@router.get("", response_model=LeaveListResponse)
def list_leaves(
    employee_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List leave requests. Employees see only their own."""
    return get_leaves_list(db, current_user, employee_id, status_filter, page, limit)


@router.put("/{leave_id}/decision", response_model=LeaveOut)
def decide_leave(
    leave_id: int,
    decision: LeaveDecisionRequest,
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """Approve or reject a pending leave request. HR/Admin only."""
    return decide_leave_request(db, current_user, leave_id, decision)


@router.put("/{leave_id}/cancel", response_model=LeaveOut)
def cancel_leave(
    leave_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a pending leave request. Employees can only cancel their own."""
    return cancel_leave_request(db, current_user, leave_id)
