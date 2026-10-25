import logging
import math
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.models import (
    Attendance,
    AttendanceCorrection,
    CompanySettings,
    Employee,
    Notification,
    User,
)
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
from app.utils.audit_service import log_audit
from app.utils.email_service import send_attendance_correction_email

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in metres between two GPS coordinates."""
    R = 6371000  # Earth radius in metres
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _resolve_employee(db: Session, current_user: User, employee_id_param: Optional[int]) -> Employee:
    """Resolve an Employee record respecting RBAC rules."""
    if current_user.role == "Employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee profile not found for current user.")
        return emp

    # HR / Admin
    if employee_id_param:
        emp = db.query(Employee).filter(Employee.id == employee_id_param).first()
        if not emp:
            raise HTTPException(status_code=404, detail=f"Employee ID {employee_id_param} not found.")
        return emp

    # HR/Admin acting as themselves
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile linked to your account.")
    return emp


def _attendance_out(record: Attendance) -> AttendanceOut:
    emp = record.employee
    return AttendanceOut(
        id=record.id,
        employee_id=record.employee_id,
        employee_code=emp.employee_code if emp else None,
        full_name=emp.full_name if emp else None,
        date=record.date,
        check_in=record.check_in,
        check_out=record.check_out,
        status=record.status,
        work_hours=record.work_hours,
        source=record.source,
        lat=record.lat,
        lng=record.lng,
        face_verified=record.face_verified,
    )


def _correction_out(c: AttendanceCorrection) -> CorrectionOut:
    emp = c.employee
    return CorrectionOut(
        id=c.id,
        attendance_id=c.attendance_id,
        employee_id=c.employee_id,
        employee_code=emp.employee_code if emp else None,
        full_name=emp.full_name if emp else None,
        date=c.date,
        requested_check_in=c.requested_check_in,
        requested_check_out=c.requested_check_out,
        reason=c.reason,
        status=c.status,
        hr_comment=c.hr_comment,
        created_at=c.created_at,
    )


# ---------------------------------------------------------------------------
# Check-In
# ---------------------------------------------------------------------------

def check_in_employee(db: Session, current_user: User, payload: CheckInRequest) -> AttendanceOut:
    server_now = datetime.now()
    today = server_now.date()

    emp = _resolve_employee(db, current_user, payload.employee_id)

    # Duplicate check
    existing = (
        db.query(Attendance)
        .filter(Attendance.employee_id == emp.id, Attendance.date == today)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already checked in today.")

    # Load company settings
    company = db.query(CompanySettings).first()
    if not company:
        raise HTTPException(status_code=500, detail="Company settings not configured.")

    # Determine late status
    try:
        h, m = map(int, company.office_start_time.split(":"))
        office_start_dt = datetime(today.year, today.month, today.day, h, m)
        cutoff_dt = office_start_dt + timedelta(minutes=company.grace_minutes or 0)
    except Exception:
        cutoff_dt = datetime(today.year, today.month, today.day, 9, 15)

    att_status = "late" if server_now.time() > cutoff_dt.time() else "present"

    # Camera / geo checks
    if payload.source == "camera":
        if payload.faces_detected != 1:
            raise HTTPException(status_code=400, detail="Face detection failed: exactly one face required.")
        if payload.accuracy > 100:
            raise HTTPException(status_code=400, detail="Invalid face recognition accuracy value.")
        if not company.office_lat or not company.office_lng:
            raise HTTPException(status_code=400, detail="Office GPS coordinates not configured.")
        if payload.lat is None or payload.lng is None:
            raise HTTPException(status_code=400, detail="GPS coordinates required for camera check-in.")
        dist = haversine_distance(payload.lat, payload.lng, company.office_lat, company.office_lng)
        if dist > (company.geofence_radius_m or 150.0):
            raise HTTPException(
                status_code=400,
                detail=f"Geofence violation: You are {dist:.1f}m from the office (limit: {company.geofence_radius_m}m).",
            )

    record = Attendance(
        employee_id=emp.id,
        date=today,
        check_in=server_now,
        status=att_status,
        work_hours=0.0,
        source=payload.source,
        lat=payload.lat,
        lng=payload.lng,
        face_verified=(payload.source == "camera"),
    )
    db.add(record)
    db.flush()

    log_audit(
        db=db,
        actor_id=current_user.id,
        action="CHECK_IN",
        entity="Attendance",
        entity_id=record.id,
        after_json={"employee_id": emp.id, "date": str(today), "status": att_status, "source": payload.source},
        commit=False,
    )

    db.commit()
    db.refresh(record)
    return _attendance_out(record)


# ---------------------------------------------------------------------------
# Check-Out
# ---------------------------------------------------------------------------

def check_out_employee(db: Session, current_user: User, payload: CheckOutRequest) -> AttendanceOut:
    server_now = datetime.now()
    today = server_now.date()

    emp = _resolve_employee(db, current_user, payload.employee_id)

    attendance = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == emp.id,
            Attendance.date == today,
            Attendance.check_out.is_(None),
        )
        .first()
    )
    if not attendance:
        raise HTTPException(status_code=404, detail="No open check-in found for today.")

    attendance.check_out = server_now
    check_in_naive = attendance.check_in.replace(tzinfo=None) if attendance.check_in.tzinfo else attendance.check_in
    work_hours = (server_now - check_in_naive).total_seconds() / 3600
    attendance.work_hours = round(work_hours, 2)

    company = db.query(CompanySettings).first()
    half_day_hours = company.half_day_hours if company else 5.0

    if work_hours < half_day_hours and attendance.status in ("present", "late"):
        attendance.status = "half_day"

    log_audit(
        db=db,
        actor_id=current_user.id,
        action="CHECK_OUT",
        entity="Attendance",
        entity_id=attendance.id,
        after_json={"work_hours": attendance.work_hours, "status": attendance.status},
        commit=False,
    )

    db.commit()
    db.refresh(attendance)
    return _attendance_out(attendance)


# ---------------------------------------------------------------------------
# Attendance List
# ---------------------------------------------------------------------------

def get_attendance_list(
    db: Session,
    current_user: User,
    employee_id: Optional[int],
    date_filter: Optional[date],
    month_filter: Optional[str],
    department_id: Optional[int],
    status_filter: Optional[str],
    page: int,
    limit: int,
) -> AttendanceListResponse:
    query = db.query(Attendance).join(Employee, Attendance.employee_id == Employee.id)

    if current_user.role == "Employee":
        query = query.filter(Employee.user_id == current_user.id)
    else:
        if employee_id:
            query = query.filter(Attendance.employee_id == employee_id)
        if department_id:
            query = query.filter(Employee.department_id == department_id)

    if date_filter:
        query = query.filter(Attendance.date == date_filter)
    if month_filter:
        try:
            y, m = map(int, month_filter.split("-"))
            from calendar import monthrange
            last_day = monthrange(y, m)[1]
            query = query.filter(
                Attendance.date >= date(y, m, 1),
                Attendance.date <= date(y, m, last_day),
            )
        except Exception:
            pass
    if status_filter:
        query = query.filter(Attendance.status == status_filter)

    total = query.count()
    offset = (page - 1) * limit
    records = query.order_by(Attendance.date.desc()).offset(offset).limit(limit).all()

    return AttendanceListResponse(
        total=total,
        page=page,
        limit=limit,
        items=[_attendance_out(r) for r in records],
    )


# ---------------------------------------------------------------------------
# Corrections
# ---------------------------------------------------------------------------

def request_correction(db: Session, current_user: User, payload: CorrectionRequest) -> CorrectionOut:
    if current_user.role == "Employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee profile not found.")
    else:
        emp_id = payload.employee_id
        if emp_id:
            emp = db.query(Employee).filter(Employee.id == emp_id).first()
            if not emp:
                raise HTTPException(status_code=404, detail=f"Employee ID {emp_id} not found.")
        else:
            emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
            if not emp:
                raise HTTPException(status_code=404, detail="No employee profile linked to your account.")

    correction = AttendanceCorrection(
        attendance_id=payload.attendance_id,
        employee_id=emp.id,
        date=payload.date,
        requested_check_in=payload.requested_check_in,
        requested_check_out=payload.requested_check_out,
        reason=payload.reason,
        status="Pending",
    )
    db.add(correction)
    db.flush()

    log_audit(
        db=db,
        actor_id=current_user.id,
        action="REQUEST_CORRECTION",
        entity="AttendanceCorrection",
        entity_id=correction.id,
        after_json={"employee_id": emp.id, "date": str(payload.date), "reason": payload.reason},
        commit=False,
    )

    db.commit()
    db.refresh(correction)
    return _correction_out(correction)


def decide_correction(
    db: Session, hr_user: User, correction_id: int, decision: CorrectionDecision
) -> CorrectionOut:
    correction = db.query(AttendanceCorrection).filter(AttendanceCorrection.id == correction_id).first()
    if not correction:
        raise HTTPException(status_code=404, detail="Correction request not found.")
    if correction.status != "Pending":
        raise HTTPException(status_code=400, detail=f"Correction is already {correction.status}.")

    before_state = {"status": correction.status}
    correction.status = decision.status
    correction.hr_comment = decision.hr_comment

    if decision.status == "Approved":
        att = None
        if correction.attendance_id:
            att = db.query(Attendance).filter(Attendance.id == correction.attendance_id).first()
        if not att:
            att = (
                db.query(Attendance)
                .filter(Attendance.employee_id == correction.employee_id, Attendance.date == correction.date)
                .first()
            )

        if att:
            if correction.requested_check_in:
                att.check_in = correction.requested_check_in
            if correction.requested_check_out:
                att.check_out = correction.requested_check_out

            if att.check_in and att.check_out:
                ci = att.check_in.replace(tzinfo=None) if att.check_in.tzinfo else att.check_in
                co = att.check_out.replace(tzinfo=None) if att.check_out.tzinfo else att.check_out
                work_hours = (co - ci).total_seconds() / 3600
                att.work_hours = round(work_hours, 2)

                company = db.query(CompanySettings).first()
                half_day_hours = company.half_day_hours if company else 5.0
                if work_hours < half_day_hours and att.status in ("present", "late"):
                    att.status = "half_day"
                elif work_hours >= half_day_hours and att.status == "half_day":
                    att.status = "present"

    # Notify employee for both Approved and Rejected decisions
    emp = db.query(Employee).filter(Employee.id == correction.employee_id).first()
    if emp and emp.user_id:
        notif_title = f"Attendance Correction {decision.status}"
        notif_msg = (
            f"Your attendance correction request for {correction.date} has been {decision.status.lower()}."
            + (f" Comment: {decision.hr_comment}" if decision.hr_comment else "")
        )
        notif = Notification(
            user_id=emp.user_id,
            title=notif_title,
            message=notif_msg,
        )
        db.add(notif)

        if emp.user and emp.user.email:
            try:
                send_attendance_correction_email(
                    to_email=emp.user.email,
                    employee_name=emp.full_name,
                    date_str=str(correction.date),
                    status=decision.status,
                    hr_comment=decision.hr_comment,
                )
            except Exception as e:
                logger.warning("Failed to send attendance correction email: %s", e)

    log_audit(
        db=db,
        actor_id=hr_user.id,
        action=f"{decision.status.upper()}_CORRECTION",
        entity="AttendanceCorrection",
        entity_id=correction.id,
        before_json=before_state,
        after_json={"status": decision.status, "hr_comment": decision.hr_comment},
        commit=False,
    )

    db.commit()
    db.refresh(correction)
    return _correction_out(correction)


def get_corrections_list(
    db: Session, current_user: User, status_filter: Optional[str], page: int, limit: int
) -> CorrectionListResponse:
    query = db.query(AttendanceCorrection)

    if current_user.role == "Employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if emp:
            query = query.filter(AttendanceCorrection.employee_id == emp.id)
        else:
            return CorrectionListResponse(total=0, page=page, limit=limit, items=[])
    else:
        if status_filter:
            query = query.filter(AttendanceCorrection.status == status_filter)

    if status_filter and current_user.role == "Employee":
        query = query.filter(AttendanceCorrection.status == status_filter)

    total = query.count()
    offset = (page - 1) * limit
    items = query.order_by(AttendanceCorrection.created_at.desc()).offset(offset).limit(limit).all()

    return CorrectionListResponse(
        total=total,
        page=page,
        limit=limit,
        items=[_correction_out(c) for c in items],
    )
