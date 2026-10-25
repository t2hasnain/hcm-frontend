from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_hr_or_admin
from app.models.models import User
from app.schemas.attendance import (
    AttendanceListResponse,
    AttendanceOut,
    CheckInRequest,
    CheckOutRequest,
    CorrectionDecision,
    CorrectionListResponse,
    CorrectionOut,
    CorrectionRequest,
)
from app.services.attendance_service import (
    check_in_employee,
    check_out_employee,
    decide_correction,
    get_attendance_list,
    get_corrections_list,
    request_correction,
)

router = APIRouter(prefix="/attendance", tags=["M4: Attendance Management"])


@router.post("/check-in", response_model=AttendanceOut)
def check_in(
    payload: CheckInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record employee check-in. Camera source requires face verification and geofence."""
    return check_in_employee(db, current_user, payload)


@router.post("/check-out", response_model=AttendanceOut)
def check_out(
    payload: CheckOutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record employee check-out and calculate work hours."""
    return check_out_employee(db, current_user, payload)


@router.post("/corrections", response_model=CorrectionOut, status_code=201)
def create_correction(
    payload: CorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit an attendance correction request."""
    return request_correction(db, current_user, payload)


@router.put("/corrections/{correction_id}", response_model=CorrectionOut)
def decide_correction_endpoint(
    correction_id: int,
    decision: CorrectionDecision,
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """Approve or reject an attendance correction request. HR/Admin only."""
    return decide_correction(db, current_user, correction_id, decision)


@router.get("/corrections", response_model=CorrectionListResponse)
def list_corrections(
    status_filter: Optional[str] = Query(None, description="Filter by status: Pending, Approved, Rejected"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List attendance correction requests. Employees see only their own."""
    return get_corrections_list(db, current_user, status_filter, page, limit)


@router.get("", response_model=AttendanceListResponse)
def list_attendance(
    employee_id: Optional[int] = Query(None),
    date_filter: Optional[date] = Query(None),
    month_filter: Optional[str] = Query(None, description="YYYY-MM format"),
    department_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List attendance records. Employees see only their own."""
    return get_attendance_list(
        db, current_user, employee_id, date_filter, month_filter, department_id, status_filter, page, limit
    )
