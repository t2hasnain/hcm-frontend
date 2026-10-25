import calendar
import io
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.models.models import (
    Attendance,
    CompanySettings,
    Employee,
    LeaveRequest,
    Notification,
    PayrollRun,
    Payslip,
    PublicHoliday,
    User,
)
from app.schemas.payroll import PayrollRunOut, PayrollRunRequest, PayslipOut
from app.utils.audit_service import log_audit
from app.utils.email_service import send_payslip_notification_email

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tax calculation
# ---------------------------------------------------------------------------

def calculate_income_tax(annual_gross: float) -> float:
    """Pakistani income tax slabs (approximate annual). Returns annual tax."""
    if annual_gross <= 600_000:
        return 0.0
    elif annual_gross <= 1_200_000:
        return (annual_gross - 600_000) * 0.05
    elif annual_gross <= 2_400_000:
        return 30_000 + (annual_gross - 1_200_000) * 0.15
    elif annual_gross <= 3_600_000:
        return 210_000 + (annual_gross - 2_400_000) * 0.25
    elif annual_gross <= 6_000_000:
        return 510_000 + (annual_gross - 3_600_000) * 0.30
    else:
        return 1_230_000 + (annual_gross - 6_000_000) * 0.35


def get_working_days_in_month(db: Session, year: int, month_int: int) -> int:
    """Count working days in a month (excluding weekends and public holidays)."""
    company = db.query(CompanySettings).first()
    weekend_days = company.weekend_days if company and company.weekend_days else ["Saturday", "Sunday"]

    first_day = date(year, month_int, 1)
    last_day = date(year, month_int, calendar.monthrange(year, month_int)[1])

    holidays = set(
        h.date
        for h in db.query(PublicHoliday).filter(
            PublicHoliday.date >= first_day,
            PublicHoliday.date <= last_day,
        ).all()
    )

    count = 0
    current = first_day
    while current <= last_day:
        if current.strftime("%A") not in weekend_days and current not in holidays:
            count += 1
        current += timedelta(days=1)
    return count


# ---------------------------------------------------------------------------
# Format helpers
# ---------------------------------------------------------------------------

def _build_payslip_out(ps: Payslip) -> PayslipOut:
    emp = ps.employee
    return PayslipOut(
        id=ps.id,
        payroll_run_id=ps.payroll_run_id,
        employee_id=ps.employee_id,
        employee_code=emp.employee_code if emp else "",
        full_name=emp.full_name if emp else "",
        basic_salary=ps.basic_salary,
        hra=ps.hra,
        medical=ps.medical,
        gross_salary=ps.gross_salary,
        working_days=ps.working_days,
        absent_days=ps.absent_days,
        unpaid_leave_days=ps.unpaid_leave_days,
        half_days=ps.half_days,
        deductions=ps.deductions,
        income_tax=ps.income_tax,
        net_salary=ps.net_salary,
    )


def _build_run_out(run: PayrollRun) -> PayrollRunOut:
    slips = [_build_payslip_out(ps) for ps in run.payslips]
    total_gross = sum(ps.gross_salary for ps in run.payslips)
    total_net = sum(ps.net_salary for ps in run.payslips)
    return PayrollRunOut(
        id=run.id,
        month=run.month,
        status=run.status,
        created_by=run.created_by,
        finalized_by=run.finalized_by,
        finalized_at=run.finalized_at,
        created_at=run.created_at,
        payslips=slips,
        total_gross=round(total_gross, 2),
        total_net=round(total_net, 2),
        employee_count=len(slips),
    )


# ---------------------------------------------------------------------------
# Generate payroll run
# ---------------------------------------------------------------------------

def generate_payroll_run(db: Session, hr_user: User, month_str: str) -> PayrollRunOut:
    import re
    if not re.match(r"^\d{4}-\d{2}$", month_str):
        raise HTTPException(status_code=400, detail="month must be in YYYY-MM format.")

    year, month_int = map(int, month_str.split("-"))

    # Check existing
    existing_run = db.query(PayrollRun).filter(PayrollRun.month == month_str).first()
    if existing_run and existing_run.status == "Finalized":
        raise HTTPException(status_code=400, detail=f"Payroll for {month_str} is already Finalized and cannot be re-run.")

    working_days_in_month = get_working_days_in_month(db, year, month_int)
    first_day = date(year, month_int, 1)
    last_day = date(year, month_int, calendar.monthrange(year, month_int)[1])

    if existing_run:
        run = existing_run
        run.status = "Draft"
        run.created_by = hr_user.id
        # Delete existing payslips
        db.query(Payslip).filter(Payslip.payroll_run_id == run.id).delete()
    else:
        run = PayrollRun(
            month=month_str,
            status="Draft",
            created_by=hr_user.id,
        )
        db.add(run)
        db.flush()

    # Get all active/probation employees
    employees = (
        db.query(Employee)
        .filter(Employee.status.in_(["Active", "Probation"]))
        .all()
    )

    for emp in employees:
        basic = emp.basic_salary or 0.0
        hra = round(basic * 0.40, 2)
        medical = round(basic * 0.10, 2)
        gross = round(basic + hra + medical, 2)

        # Count attendance
        attendances = (
            db.query(Attendance)
            .filter(
                Attendance.employee_id == emp.id,
                Attendance.date >= first_day,
                Attendance.date <= last_day,
                Attendance.status.in_(["present", "late", "half_day", "missing_checkout"]),
            )
            .all()
        )
        attended_count = len(attendances)
        half_days = sum(1 for a in attendances if a.status == "half_day")
        late_count = sum(1 for a in attendances if a.status == "late")
        absent_days = max(0, working_days_in_month - attended_count)

        # Bonus Feature Rule: 3 lates = 0.5 day wage deduction
        late_penalty_days = (late_count // 3) * 0.5

        # Unpaid leaves
        unpaid_leaves = (
            db.query(LeaveRequest)
            .filter(
                LeaveRequest.employee_id == emp.id,
                LeaveRequest.status == "Approved",
                LeaveRequest.leave_type == "Unpaid",
                LeaveRequest.start_date >= first_day,
                LeaveRequest.end_date <= last_day,
            )
            .all()
        )
        unpaid_leave_days = sum(l.working_days for l in unpaid_leaves)

        # Deductions: absent days + unpaid leave days + half days + late penalties (3 lates = 0.5 day)
        daily_rate = gross / working_days_in_month if working_days_in_month > 0 else 0.0
        total_deduction_days = absent_days + unpaid_leave_days + (half_days * 0.5) + late_penalty_days
        deductions = round(total_deduction_days * daily_rate, 2)

        # Income tax (monthly)
        annual_gross = gross * 12
        annual_tax = calculate_income_tax(annual_gross)
        monthly_tax = round(annual_tax / 12, 2)

        net = max(0.0, round(gross - deductions - monthly_tax, 2))

        ps = Payslip(
            payroll_run_id=run.id,
            employee_id=emp.id,
            basic_salary=basic,
            hra=hra,
            medical=medical,
            gross_salary=gross,
            working_days=working_days_in_month,
            absent_days=absent_days,
            unpaid_leave_days=unpaid_leave_days,
            half_days=half_days,
            deductions=deductions,
            income_tax=monthly_tax,
            net_salary=net,
        )
        db.add(ps)

    log_audit(
        db=db,
        actor_id=hr_user.id,
        action="GENERATE_PAYROLL",
        entity="PayrollRun",
        entity_id=run.id,
        after_json={"month": month_str, "status": "Draft"},
        commit=False,
    )

    db.commit()
    db.refresh(run)
    return _build_run_out(run)


# ---------------------------------------------------------------------------
# Finalize
# ---------------------------------------------------------------------------

def finalize_payroll_run(db: Session, admin_user: User, run_id: int) -> PayrollRunOut:
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")
    if run.status != "Draft":
        raise HTTPException(status_code=400, detail=f"Payroll run is already {run.status}.")

    run.status = "Finalized"
    run.finalized_by = admin_user.id
    run.finalized_at = datetime.now()

    for ps in run.payslips:
        emp = ps.employee
        if emp and emp.user_id:
            notif = Notification(
                user_id=emp.user_id,
                title=f"Payslip for {run.month}",
                message=f"Your payslip for {run.month} is ready. Net salary: PKR {ps.net_salary:,.2f}",
            )
            db.add(notif)
            if emp.user:
                try:
                    send_payslip_notification_email(
                        to_email=emp.user.email,
                        employee_name=emp.full_name,
                        month=run.month,
                        net_salary=ps.net_salary,
                    )
                except Exception as e:
                    logger.warning("Email send failed for %s: %s", emp.full_name, e)

    log_audit(
        db=db,
        actor_id=admin_user.id,
        action="FINALIZE_PAYROLL",
        entity="PayrollRun",
        entity_id=run.id,
        before_json={"status": "Draft"},
        after_json={"status": "Finalized"},
        commit=False,
    )

    db.commit()
    db.refresh(run)
    return _build_run_out(run)


# ---------------------------------------------------------------------------
# List runs
# ---------------------------------------------------------------------------

def list_payroll_runs(db: Session) -> List[PayrollRunOut]:
    runs = db.query(PayrollRun).order_by(PayrollRun.month.desc()).all()
    return [_build_run_out(r) for r in runs]


def get_payroll_run(db: Session, run_id: int) -> PayrollRunOut:
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")
    return _build_run_out(run)


# ---------------------------------------------------------------------------
# Payslip
# ---------------------------------------------------------------------------

def get_payslip(db: Session, current_user: User, payslip_id: int) -> PayslipOut:
    ps = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Payslip not found.")

    if current_user.role == "Employee":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or ps.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Access forbidden: not your payslip.")

    return _build_payslip_out(ps)


# ---------------------------------------------------------------------------
# PDF generation
# ---------------------------------------------------------------------------

def generate_payslip_pdf(db: Session, current_user: User, payslip_id: int) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    ps = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Payslip not found.")

    if current_user.role == "Employee":
        emp_check = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp_check or ps.employee_id != emp_check.id:
            raise HTTPException(status_code=403, detail="Access forbidden: not your payslip.")

    company = db.query(CompanySettings).first()
    company_name = company.company_name if company else "HCM Lite Enterprise"

    emp = ps.employee
    run = ps.payroll_run

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("title", fontSize=18, fontName="Helvetica-Bold", alignment=1, spaceAfter=6)
    sub_style = ParagraphStyle("sub", fontSize=11, fontName="Helvetica", alignment=1, spaceAfter=12, textColor=colors.grey)
    label_style = ParagraphStyle("label", fontSize=10, fontName="Helvetica-Bold")

    story.append(Paragraph(company_name, title_style))
    story.append(Paragraph(f"Payslip — {run.month if run else 'N/A'}", sub_style))
    story.append(Spacer(1, 0.5 * cm))

    # Employee info table
    emp_data = [
        ["Employee", emp.full_name if emp else "N/A", "Employee Code", emp.employee_code if emp else "N/A"],
        ["Department", emp.department.name if emp and emp.department else "N/A", "Designation", emp.designation.title if emp and emp.designation else "N/A"],
        ["Status", emp.status if emp else "N/A", "Generated On", datetime.now().strftime("%Y-%m-%d")],
    ]
    emp_table = Table(emp_data, colWidths=[4 * cm, 6 * cm, 4 * cm, 6 * cm])
    emp_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EEF2FF")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#EEF2FF")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(emp_table)
    story.append(Spacer(1, 0.5 * cm))

    # Salary breakdown table
    story.append(Paragraph("Salary Breakdown", label_style))
    story.append(Spacer(1, 0.2 * cm))

    sal_data = [
        ["Component", "Amount (PKR)"],
        ["Basic Salary", f"{ps.basic_salary:,.2f}"],
        ["HRA (40% of Basic)", f"{ps.hra:,.2f}"],
        ["Medical Allowance (10% of Basic)", f"{ps.medical:,.2f}"],
        ["Gross Salary", f"{ps.gross_salary:,.2f}"],
        ["", ""],
        ["Working Days", str(ps.working_days)],
        ["Absent Days", str(ps.absent_days)],
        ["Unpaid Leave Days", str(ps.unpaid_leave_days)],
        ["Half Days", str(ps.half_days)],
        ["", ""],
        ["Deductions (Absence/Unpaid)", f"- {ps.deductions:,.2f}"],
        ["Income Tax (Monthly)", f"- {ps.income_tax:,.2f}"],
        ["Net Salary", f"{ps.net_salary:,.2f}"],
    ]

    sal_table = Table(sal_data, colWidths=[12 * cm, 6 * cm])
    sal_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.lightgrey),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#D1FAE5")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 10),
    ]))
    story.append(sal_table)
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("This is a system-generated payslip and does not require a signature.", sub_style))

    doc.build(story)
    return buf.getvalue()
