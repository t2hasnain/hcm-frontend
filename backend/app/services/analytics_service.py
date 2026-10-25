import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.models import (
    Attendance,
    AttendanceCorrection,
    AuditLog,
    Department,
    Employee,
    LeaveRequest,
    Notification,
    PayrollRun,
    Payslip,
    User,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Admin Dashboard
# ---------------------------------------------------------------------------

def get_admin_dashboard(db: Session) -> Dict[str, Any]:
    today = date.today()
    current_month = today.strftime("%Y-%m")
    current_year = today.year

    # Headcount breakdown
    active_count = db.query(Employee).filter(Employee.status == "Active").count()
    probation_count = db.query(Employee).filter(Employee.status == "Probation").count()
    total_active_probation = active_count + probation_count
    total_exited = db.query(Employee).filter(Employee.status == "Exited").count()
    total_all = db.query(Employee).count()

    attrition_rate = (
        round((total_exited / max(1, total_all)) * 100, 1)
        if total_all > 0
        else 0.0
    )

    # Attendance Today
    checked_in_today = (
        db.query(Attendance)
        .filter(Attendance.date == today, Attendance.status.in_(["present", "late"]))
        .count()
    )
    absent_today = max(0, total_active_probation - checked_in_today)
    pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.status == "Pending").count()

    # Payroll metrics
    payroll_run = db.query(PayrollRun).filter(PayrollRun.month == current_month).first()
    payroll_status = payroll_run.status if payroll_run else "Not Generated"

    if payroll_run:
        total_gross_payroll = (
            db.query(func.sum(Payslip.gross_salary))
            .filter(Payslip.payroll_run_id == payroll_run.id)
            .scalar() or 0.0
        )
        total_net_payroll = (
            db.query(func.sum(Payslip.net_salary))
            .filter(Payslip.payroll_run_id == payroll_run.id)
            .scalar() or 0.0
        )
    else:
        # Estimate from active employees basic salary
        active_employees = db.query(Employee).filter(Employee.status.in_(["Active", "Probation"])).all()
        total_gross_payroll = sum((e.basic_salary or 0.0) * 1.50 for e in active_employees)
        total_net_payroll = total_gross_payroll

    # Average salary
    avg_salary_val = (
        db.query(func.avg(Employee.basic_salary))
        .filter(Employee.status.in_(["Active", "Probation"]))
        .scalar()
    )
    avg_salary = round(float(avg_salary_val or 0.0), 2)

    # Headcount by Department
    depts = db.query(Department).all()
    headcount_by_department: List[Dict[str, Any]] = []
    payroll_by_department: List[Dict[str, Any]] = []

    for d in depts:
        count = (
            db.query(Employee)
            .filter(Employee.department_id == d.id, Employee.status.in_(["Active", "Probation"]))
            .count()
        )
        headcount_by_department.append({"department": d.name, "count": count})

        dept_basic_sum = (
            db.query(func.sum(Employee.basic_salary))
            .filter(Employee.department_id == d.id, Employee.status.in_(["Active", "Probation"]))
            .scalar() or 0.0
        )
        dept_gross = round(float(dept_basic_sum) * 1.50, 2)
        payroll_by_department.append({
            "department": d.name,
            "gross": dept_gross,
            "net": dept_gross,
        })

    # If no departments exist but employees exist, group without dept
    if not depts and total_active_probation > 0:
        headcount_by_department.append({"department": "General", "count": total_active_probation})
        payroll_by_department.append({"department": "General", "gross": total_gross_payroll, "net": total_net_payroll})

    # Gender Breakdown
    gender_counts = (
        db.query(Employee.gender, func.count(Employee.id))
        .filter(Employee.status.in_(["Active", "Probation"]))
        .group_by(Employee.gender)
        .all()
    )
    gender_breakdown = {g[0] or "Unspecified": g[1] for g in gender_counts}

    # Tenure Breakdown
    tenure_breakdown = {
        "< 1 Year": 0,
        "1-2 Years": 0,
        "2-5 Years": 0,
        "5+ Years": 0,
    }
    all_active = db.query(Employee).filter(Employee.status.in_(["Active", "Probation"])).all()
    for e in all_active:
        if e.joining_date:
            days = (today - e.joining_date).days
            years = days / 365.25
            if years < 1:
                tenure_breakdown["< 1 Year"] += 1
            elif years < 2:
                tenure_breakdown["1-2 Years"] += 1
            elif years < 5:
                tenure_breakdown["2-5 Years"] += 1
            else:
                tenure_breakdown["5+ Years"] += 1

    # Recent Audit Logs with actor email
    recent_audits = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent_audit_feed = []
    for a in recent_audits:
        actor_email = "System"
        if a.actor_id:
            actor = db.query(User).filter(User.id == a.actor_id).first()
            if actor:
                actor_email = actor.email
        recent_audit_feed.append({
            "id": a.id,
            "actor_email": actor_email,
            "action": a.action,
            "entity": a.entity,
            "entity_id": a.entity_id,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return {
        # Structured for frontend AdminDashboardPage
        "headcount": {
            "active": active_count,
            "probation": probation_count,
            "total": total_active_probation,
        },
        "attrition_rate": attrition_rate,
        "payroll": {
            "month": current_month,
            "total_gross": round(float(total_gross_payroll), 2),
            "total_net": round(float(total_net_payroll), 2),
        },
        "avg_salary": avg_salary,
        "headcount_by_department": headcount_by_department,
        "payroll_by_department": payroll_by_department,
        "gender_breakdown": gender_breakdown,
        "tenure_breakdown": tenure_breakdown,
        "recent_audit_feed": recent_audit_feed,
        "attrition_risk_summary": calculate_attrition_risks(db),

        # Backward compatibility flat keys
        "total_employees": total_active_probation,
        "checked_in_today": checked_in_today,
        "absent_today": absent_today,
        "pending_leaves": pending_leaves,
        "payroll_month": current_month,
        "payroll_status": payroll_status,
        "total_net_payroll": round(float(total_net_payroll), 2),
        "recent_audit_logs": recent_audit_feed,
    }


# ---------------------------------------------------------------------------
# HR Dashboard
# ---------------------------------------------------------------------------

def get_hr_dashboard(db: Session) -> Dict[str, Any]:
    today = date.today()
    current_year = today.year
    month_start = date(today.year, today.month, 1)
    year_start = date(current_year, 1, 1)

    total_employees = db.query(Employee).filter(Employee.status.in_(["Active", "Probation"])).count()

    present_today = (
        db.query(Attendance)
        .filter(Attendance.date == today, Attendance.status.in_(["present", "late"]))
        .count()
    )
    late_today = (
        db.query(Attendance)
        .filter(Attendance.date == today, Attendance.status == "late")
        .count()
    )

    # On leave today
    approved_leaves_today = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.status == "Approved",
            LeaveRequest.start_date <= today,
            LeaveRequest.end_date >= today,
        )
        .all()
    )
    casual_today = sum(1 for l in approved_leaves_today if l.leave_type == "Casual")
    sick_today = sum(1 for l in approved_leaves_today if l.leave_type == "Sick")
    annual_today = sum(1 for l in approved_leaves_today if l.leave_type == "Annual")
    unpaid_today = sum(1 for l in approved_leaves_today if l.leave_type == "Unpaid")

    # Pending approvals
    pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.status == "Pending").count()
    pending_corrections = db.query(AttendanceCorrection).filter(AttendanceCorrection.status == "Pending").count()

    # Attendance rate today
    attendance_rate = (
        round((present_today / max(1, total_employees)) * 100, 1)
        if total_employees > 0
        else 0.0
    )

    # Late percentage by Department
    depts = db.query(Department).all()
    late_pct_by_department: List[Dict[str, Any]] = []
    for d in depts:
        dept_emp_ids = [e.id for e in db.query(Employee.id).filter(Employee.department_id == d.id).all()]
        if dept_emp_ids:
            dept_att_month = (
                db.query(Attendance)
                .filter(Attendance.employee_id.in_(dept_emp_ids), Attendance.date >= month_start)
                .all()
            )
            late_dept = sum(1 for a in dept_att_month if a.status == "late")
            pct = round((late_dept / max(1, len(dept_att_month))) * 100, 1)
            late_pct_by_department.append({"department": d.name, "late_pct": pct})
        else:
            late_pct_by_department.append({"department": d.name, "late_pct": 0.0})

    # Leave utilization YTD
    approved_ytd = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.status == "Approved", LeaveRequest.start_date >= year_start)
        .all()
    )
    leave_utilization = {
        "Annual": sum(l.working_days for l in approved_ytd if l.leave_type == "Annual"),
        "Sick": sum(l.working_days for l in approved_ytd if l.leave_type == "Sick"),
        "Casual": sum(l.working_days for l in approved_ytd if l.leave_type == "Casual"),
        "Unpaid": sum(l.working_days for l in approved_ytd if l.leave_type == "Unpaid"),
    }

    # Top late comers this month
    late_records = (
        db.query(Attendance.employee_id, func.count(Attendance.id))
        .filter(Attendance.date >= month_start, Attendance.status == "late")
        .group_by(Attendance.employee_id)
        .order_by(func.count(Attendance.id).desc())
        .limit(5)
        .all()
    )
    top_late_comers = []
    for lr in late_records:
        emp = db.query(Employee).filter(Employee.id == lr[0]).first()
        if emp:
            top_late_comers.append({
                "employee_code": emp.employee_code,
                "full_name": emp.full_name,
                "late_count": lr[1],
            })

    # Bonus: Attrition risk analysis & absence anomaly flags
    attrition_summary = calculate_attrition_risks(db)
    absence_anomalies = detect_absence_anomalies(db)

    return {
        "headcount": total_employees,
        "present_today": present_today,
        "late_today": late_today,
        "on_leave_today": {
            "total": len(approved_leaves_today),
            "casual": casual_today,
            "sick": sick_today,
            "annual": annual_today,
            "unpaid": unpaid_today,
        },
        "pending_approvals": {
            "leaves": pending_leaves,
            "corrections": pending_corrections,
            "total": pending_leaves + pending_corrections,
        },
        "attendance_rate": attendance_rate,
        "late_pct_by_department": late_pct_by_department,
        "leave_utilization": leave_utilization,
        "top_late_comers": top_late_comers,
        "attrition_risk_summary": attrition_summary,
        "absence_anomalies": absence_anomalies,

        # Backward compatibility
        "total_employees": total_employees,
        "pending_leave_requests": pending_leaves,
        "approved_leaves_ytd": len(approved_ytd),
    }


def calculate_attrition_risks(db: Session) -> Dict[str, Any]:
    active_employees = db.query(Employee).filter(Employee.status.in_(["Active", "Probation"])).all()
    if not active_employees:
        return {"average_score": 0.0, "high_risk_count": 0, "at_risk": []}

    avg_salary = db.query(func.avg(Employee.basic_salary)).filter(Employee.status.in_(["Active", "Probation"])).scalar() or 0.0
    today = date.today()
    month_start = date(today.year, today.month, 1)

    scored = []
    for emp in active_employees:
        score = 0
        reasons = []
        if (emp.basic_salary or 0) < (float(avg_salary) * 0.85):
            score += 25
            reasons.append("Compensation below peer average")
        lates = db.query(Attendance).filter(Attendance.employee_id == emp.id, Attendance.date >= month_start, Attendance.status == "late").count()
        if lates >= 3:
            score += 25
            reasons.append(f"Frequent late arrivals ({lates} this month)")
        if emp.status == "Probation" or (emp.joining_date and (today - emp.joining_date).days < 180):
            score += 20
            reasons.append("Early onboarding tenure (< 6 months)")
        consumed = db.query(func.sum(LeaveRequest.working_days)).filter(
            LeaveRequest.employee_id == emp.id,
            LeaveRequest.status == "Approved",
            LeaveRequest.start_date >= date(today.year, 1, 1),
        ).scalar() or 0
        if consumed >= 10:
            score += 20
            reasons.append(f"High leave consumption ({int(consumed)} days taken)")

        level = "High" if score >= 60 else "Moderate" if score >= 35 else "Low"
        if score >= 35:
            scored.append({
                "employee_code": emp.employee_code,
                "full_name": emp.full_name,
                "score": score,
                "risk_level": level,
                "primary_risk": reasons[0] if reasons else "Tenure factor",
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    avg_score = round(sum(s["score"] for s in scored) / max(1, len(scored)), 1) if scored else 12.0
    return {
        "average_score": avg_score,
        "high_risk_count": sum(1 for s in scored if s["risk_level"] == "High"),
        "at_risk": scored[:5],
    }


def detect_absence_anomalies(db: Session) -> List[Dict[str, Any]]:
    today = date.today()
    month_start = date(today.year, today.month, 1)
    active_employees = db.query(Employee).filter(Employee.status.in_(["Active", "Probation"])).all()
    anomalies = []

    for emp in active_employees:
        atts = db.query(Attendance).filter(
            Attendance.employee_id == emp.id,
            Attendance.date >= month_start,
        ).all()
        half_days = sum(1 for a in atts if a.status == "half_day")
        if half_days >= 2:
            anomalies.append({
                "employee_code": emp.employee_code,
                "full_name": emp.full_name,
                "anomaly_type": "Partial Shift Pattern",
                "details": f"{half_days} half-day shifts recorded this month.",
            })
        missing_cos = sum(1 for a in atts if a.status == "missing_checkout")
        if missing_cos >= 2:
            anomalies.append({
                "employee_code": emp.employee_code,
                "full_name": emp.full_name,
                "anomaly_type": "Missing Punch-Outs",
                "details": f"{missing_cos} uncompleted checkouts requiring correction.",
            })

    return anomalies[:5]


# ---------------------------------------------------------------------------
# Employee Dashboard
# ---------------------------------------------------------------------------

def get_employee_dashboard(db: Session, current_user: User) -> Dict[str, Any]:
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return {"error": "No employee profile found."}

    today = date.today()
    current_year = today.year
    year_start = date(current_year, 1, 1)

    attendance_today = (
        db.query(Attendance)
        .filter(Attendance.employee_id == emp.id, Attendance.date == today)
        .first()
    )

    monthly_attendances = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == emp.id,
            Attendance.date >= date(today.year, today.month, 1),
            Attendance.date <= today,
        )
        .all()
    )

    approved_leaves = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == emp.id,
            LeaveRequest.status == "Approved",
            LeaveRequest.start_date >= year_start,
        )
        .all()
    )

    from app.models.models import CompanySettings
    company = db.query(CompanySettings).first()
    annual_quota = company.annual_leave_quota if company else 14
    sick_quota = company.sick_leave_quota if company else 8
    casual_quota = company.casual_leave_quota if company else 10

    annual_used = sum(l.working_days for l in approved_leaves if l.leave_type == "Annual")
    sick_used = sum(l.working_days for l in approved_leaves if l.leave_type == "Sick")
    casual_used = sum(l.working_days for l in approved_leaves if l.leave_type == "Casual")

    pending_leaves = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == emp.id, LeaveRequest.status == "Pending")
        .count()
    )

    unread_notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )

    return {
        "employee_id": emp.id,
        "employee_code": emp.employee_code,
        "full_name": emp.full_name,
        "today_attendance": {
            "checked_in": attendance_today is not None,
            "status": attendance_today.status if attendance_today else None,
            "check_in": attendance_today.check_in.isoformat() if attendance_today and attendance_today.check_in else None,
            "check_out": attendance_today.check_out.isoformat() if attendance_today and attendance_today.check_out else None,
        },
        "today_status": {
            "checked_in": attendance_today is not None,
            "status": attendance_today.status if attendance_today else None,
            "check_in_time": attendance_today.check_in.strftime("%H:%M") if attendance_today and attendance_today.check_in else None,
            "check_out_time": attendance_today.check_out.strftime("%H:%M") if attendance_today and attendance_today.check_out else None,
        },
        "month_summary": {
            "present": sum(1 for a in monthly_attendances if a.status in ("present", "late")),
            "late": sum(1 for a in monthly_attendances if a.status == "late"),
            "half_day": sum(1 for a in monthly_attendances if a.status == "half_day"),
            "total_hours": round(sum(a.work_hours or 0 for a in monthly_attendances), 2),
        },
        "leave_balance": {
            "annual": {"quota": annual_quota, "used": annual_used, "remaining": max(0, annual_quota - annual_used)},
            "sick": {"quota": sick_quota, "used": sick_used, "remaining": max(0, sick_quota - sick_used)},
            "casual": {"quota": casual_quota, "used": casual_used, "remaining": max(0, casual_quota - casual_used)},
        },
        "pending_leave_requests": pending_leaves,
        "unread_notifications": unread_notifications,
    }
