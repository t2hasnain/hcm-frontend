import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import (
    CompanySettings,
    Employee,
    LeaveRequest,
    Notification,
    PublicHoliday,
    User,
)
from app.schemas.leave import (
    LeaveApplyRequest,
    LeaveBalanceResponse,
    LeaveDecisionRequest,
    LeaveListResponse,
    LeaveOut,
    LeaveTypeBalance,
)
from app.utils.audit_service import log_audit
from app.utils.email_service import send_leave_notification_email

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def calculate_working_days(db: Session, start_date: date, end_date: date) -> int:
    """Count working days between start and end (inclusive), skipping weekends and public holidays."""
    company = db.query(CompanySettings).first()
    weekend_days = company.weekend_days if company and company.weekend_days else ["Saturday", "Sunday"]

    holidays = set(
        h.date
        for h in db.query(PublicHoliday).filter(
            PublicHoliday.date >= start_date,
            PublicHoliday.date <= end_date,
        ).all()
    )

    count = 0
    current = start_date
    while current <= end_date:
        if current.strftime("%A") not in weekend_days and current not in holidays:
            count += 1
        current += timedelta(days=1)
    return count


def get_leave_balance_for_employee(db: Session, employee_id: int) -> dict:
    company = db.query(CompanySettings).first()
    annual_quota = company.annual_leave_quota if company else 14
    sick_quota = company.sick_leave_quota if company else 8
    casual_quota = company.casual_leave_quota if company else 10

    year = datetime.now().year
    start_of_year = date(year, 1, 1)
    end_of_year = date(year, 12, 31)

    approved = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == "Approved",
            LeaveRequest.start_date >= start_of_year,
            LeaveRequest.start_date <= end_of_year,
        )
        .all()
    )

    annual_used = sum(l.working_days for l in approved if l.leave_type == "Annual")
    sick_used = sum(l.working_days for l in approved if l.leave_type == "Sick")
    casual_used = sum(l.working_days for l in approved if l.leave_type == "Casual")
    unpaid_used = sum(l.working_days for l in approved if l.leave_type == "Unpaid")

    return {
        "annual_quota": annual_quota,
        "annual_used": annual_used,
        "sick_quota": sick_quota,
        "sick_used": sick_used,
        "casual_quota": casual_quota,
        "casual_used": casual_used,
        "unpaid_used": unpaid_used,
        "year": year,
    }


def _leave_out(leave: LeaveRequest) -> LeaveOut:
    emp = leave.employee
    return LeaveOut(
        id=leave.id,
        employee_id=leave.employee_id,
        employee_code=emp.employee_code if emp else None,
        full_name=emp.full_name if emp else None,
        leave_type=leave.leave_type,
        start_date=leave.start_date,
        end_date=leave.end_date,
        working_days=leave.working_days,
        reason=leave.reason,
        status=leave.status,
        hr_comment=leave.hr_comment,
        created_at=leave.created_at,
    )


# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------

def apply_for_leave(db: Session, current_user: User, payload: LeaveApplyRequest) -> LeaveOut:
    # Resolve employee
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile linked to your account.")

    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="end_date cannot be before start_date.")

    working_days = calculate_working_days(db, payload.start_date, payload.end_date)
    if working_days == 0:
        raise HTTPException(status_code=422, detail="No working days in the selected date range.")

    # Overlap check
    overlap = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == emp.id,
            LeaveRequest.status.in_(["Pending", "Approved"]),
            LeaveRequest.end_date >= payload.start_date,
            LeaveRequest.start_date <= payload.end_date,
        )
        .first()
    )
    if overlap:
        raise HTTPException(
            status_code=422,
            detail=f"Leave overlaps with an existing {overlap.status} request (ID: {overlap.id}).",
        )

    # Quota check (not for Unpaid)
    if payload.leave_type != "Unpaid":
        balance = get_leave_balance_for_employee(db, emp.id)
        quota_key = f"{payload.leave_type.lower()}_quota"
        used_key = f"{payload.leave_type.lower()}_used"
        quota = balance.get(quota_key, 0)
        used = balance.get(used_key, 0)
        remaining = quota - used
        if working_days > remaining:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient {payload.leave_type} leave balance. Remaining: {remaining} day(s), Requested: {working_days} day(s).",
            )

    leave = LeaveRequest(
        employee_id=emp.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        working_days=working_days,
        reason=payload.reason,
        status="Pending",
    )
    db.add(leave)
    db.flush()

    log_audit(
        db=db,
        actor_id=current_user.id,
        action="APPLY_LEAVE",
        entity="LeaveRequest",
        entity_id=leave.id,
        after_json={
            "employee_id": emp.id,
            "leave_type": payload.leave_type,
            "start_date": str(payload.start_date),
            "end_date": str(payload.end_date),
            "working_days": working_days,
        },
        commit=False,
    )

    db.commit()
    db.refresh(leave)
    return _leave_out(leave)


# ---------------------------------------------------------------------------
# Decision
# ---------------------------------------------------------------------------

def decide_leave_request(
    db: Session, hr_user: User, leave_id: int, decision: LeaveDecisionRequest
) -> LeaveOut:
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    if leave.status != "Pending":
        raise HTTPException(status_code=400, detail=f"Leave is already {leave.status}.")

    before_state = {"status": leave.status}
    leave.status = decision.status
    leave.hr_comment = decision.hr_comment

    emp = leave.employee
    if emp and emp.user_id:
        notif = Notification(
            user_id=emp.user_id,
            title=f"Leave {decision.status}",
            message=(
                f"Your {leave.leave_type} leave from {leave.start_date} to {leave.end_date} "
                f"has been {decision.status}."
            ),
        )
        db.add(notif)

        if emp.user:
            try:
                send_leave_notification_email(
                    to_email=emp.user.email,
                    employee_name=emp.full_name,
                    leave_type=leave.leave_type,
                    status=decision.status,
                    hr_comment=decision.hr_comment or "",
                )
            except Exception as e:
                logger.warning("Email send failed: %s", e)

    log_audit(
        db=db,
        actor_id=hr_user.id,
        action=f"{decision.status.upper()}_LEAVE",
        entity="LeaveRequest",
        entity_id=leave.id,
        before_json=before_state,
        after_json={"status": decision.status, "hr_comment": decision.hr_comment},
        commit=False,
    )

    db.commit()
    db.refresh(leave)
    return _leave_out(leave)


# ---------------------------------------------------------------------------
# Cancel
# ---------------------------------------------------------------------------

def cancel_leave_request(db: Session, current_user: User, leave_id: int) -> LeaveOut:
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if current_user.role == "Employee":
        if not emp or leave.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="You can only cancel your own leave requests.")

    if leave.status != "Pending":
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {leave.status} leave request.")

    leave.status = "Cancelled"

    log_audit(
        db=db,
        actor_id=current_user.id,
        action="CANCEL_LEAVE",
        entity="LeaveRequest",
        entity_id=leave.id,
        before_json={"status": "Pending"},
        after_json={"status": "Cancelled"},
        commit=False,
    )

    db.commit()
    db.refresh(leave)
    return _leave_out(leave)


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def get_leaves_list(
    db: Session,
    current_user: User,
    employee_id: Optional[int],
    status_filter: Optional[str],
    page: int,
    limit: int,
) -> LeaveListResponse:
    query = db.query(LeaveRequest)

    if current_user.role == "Employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if emp:
            query = query.filter(LeaveRequest.employee_id == emp.id)
        else:
            return LeaveListResponse(total=0, page=page, limit=limit, items=[])
    else:
        if employee_id:
            query = query.filter(LeaveRequest.employee_id == employee_id)
        if status_filter:
            query = query.filter(LeaveRequest.status == status_filter)

    total = query.count()
    offset = (page - 1) * limit
    records = query.order_by(LeaveRequest.created_at.desc()).offset(offset).limit(limit).all()

    return LeaveListResponse(
        total=total,
        page=page,
        limit=limit,
        items=[_leave_out(r) for r in records],
    )


# ---------------------------------------------------------------------------
# Balance
# ---------------------------------------------------------------------------

def get_leave_balance(db: Session, employee_id: int) -> LeaveBalanceResponse:
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee ID {employee_id} not found.")

    balance = get_leave_balance_for_employee(db, employee_id)

    return LeaveBalanceResponse(
        employee_id=emp.id,
        employee_code=emp.employee_code,
        full_name=emp.full_name,
        year=balance["year"],
        annual=LeaveTypeBalance(
            quota=balance["annual_quota"],
            used=balance["annual_used"],
            remaining=max(0, balance["annual_quota"] - balance["annual_used"]),
        ),
        sick=LeaveTypeBalance(
            quota=balance["sick_quota"],
            used=balance["sick_used"],
            remaining=max(0, balance["sick_quota"] - balance["sick_used"]),
        ),
        casual=LeaveTypeBalance(
            quota=balance["casual_quota"],
            used=balance["casual_used"],
            remaining=max(0, balance["casual_quota"] - balance["casual_used"]),
        ),
        unpaid_used=balance["unpaid_used"],
    )
