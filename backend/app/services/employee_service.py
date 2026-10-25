import csv
import io
import logging
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
import pandas as pd
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import enforce_employee_scope
from app.core.security import get_password_hash
from app.models.models import (
    Attendance,
    CompanySettings,
    Department,
    Designation,
    Employee,
    LeaveRequest,
    Payslip,
    User,
)
from app.schemas.employee import (
    AttendanceSummary,
    CSVDryRunError,
    CSVImportResponse,
    Employee360Profile,
    EmployeeCreate,
    EmployeeCreatedResponse,
    EmployeeListResponse,
    EmployeeOut,
    EmployeeUpdate,
    LeaveBalances,
    LeaveTypeBalance,
    SalaryBreakdown,
)
from app.services.auth_service import generate_secure_temporary_password
from app.services.setup_service import get_company_settings
from app.utils.audit_service import log_audit
from app.utils.email_service import send_temporary_password_email

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def _format_employee_out(emp: Employee) -> EmployeeOut:
    return EmployeeOut(
        id=emp.id,
        user_id=emp.user_id,
        employee_code=emp.employee_code,
        full_name=emp.full_name,
        email=emp.user.email if emp.user else "",
        phone=emp.phone,
        address=emp.address,
        gender=emp.gender,
        department_id=emp.department_id,
        department_name=emp.department.name if emp.department else None,
        designation_id=emp.designation_id,
        designation_title=emp.designation.title if emp.designation else None,
        joining_date=emp.joining_date,
        exit_date=emp.exit_date,
        status=emp.status,
        basic_salary=emp.basic_salary,
        role=emp.user.role if emp.user else "Employee",
        is_active=emp.user.is_active if emp.user else True,
        created_at=emp.created_at,
    )


# -------------------------------------------------------------
# Employee Registration & Management
# -------------------------------------------------------------
def create_employee(
    db: Session,
    actor: User,
    payload: EmployeeCreate,
) -> EmployeeCreatedResponse:
    """
    Registers an employee with job details and basic_salary > 0.
    Automatically creates User login (role='Employee', must_change_password=True).
    Dispatches onboarding email with temporary password.
    Logs audit and returns created employee + temporary password.
    """
    if payload.basic_salary <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Basic salary must be strictly greater than 0.",
        )

    # Check email uniqueness
    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User login with email '{payload.email}' already exists.",
        )

    # Resolve or auto-generate employee code
    emp_code = payload.employee_code
    if emp_code:
        emp_code = emp_code.strip()
        existing_emp = db.query(Employee).filter(Employee.employee_code == emp_code).first()
        if existing_emp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee code '{emp_code}' is already assigned to another employee.",
            )
    else:
        total = db.query(Employee).count()
        emp_code = f"EMP-{2001 + total}"

    # Verify department and designation if provided
    if payload.department_id:
        dept = db.query(Department).filter(Department.id == payload.department_id).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")

    if payload.designation_id:
        desig = db.query(Designation).filter(Designation.id == payload.designation_id).first()
        if not desig:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found.")

    temp_password = generate_secure_temporary_password(12)

    # 1. Create User
    new_user = User(
        email=payload.email.lower(),
        password_hash=get_password_hash(temp_password),
        role="Employee",
        must_change_password=True,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    # 2. Create Employee
    new_employee = Employee(
        user_id=new_user.id,
        employee_code=emp_code,
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        address=payload.address,
        gender=payload.gender,
        department_id=payload.department_id,
        designation_id=payload.designation_id,
        joining_date=payload.joining_date,
        status=payload.status,
        basic_salary=payload.basic_salary,
    )
    db.add(new_employee)
    db.flush()

    # 3. Log Audit
    log_audit(
        db=db,
        actor_id=actor.id,
        action="CREATE_EMPLOYEE",
        entity="Employee",
        entity_id=new_employee.id,
        after_json={
            "employee_code": new_employee.employee_code,
            "full_name": new_employee.full_name,
            "email": new_user.email,
            "basic_salary": new_employee.basic_salary,
        },
        commit=False,
    )

    db.commit()
    db.refresh(new_employee)
    db.refresh(new_user)

    # 4. Dispatch Email
    email_sent = send_temporary_password_email(
        to_email=new_user.email,
        user_name=new_employee.full_name,
        temp_password=temp_password,
        role="Employee",
    )

    logger.info("Employee %s (%s) registered by %s", new_employee.full_name, emp_code, actor.email)

    return EmployeeCreatedResponse(
        employee=_format_employee_out(new_employee),
        temporary_password=temp_password,
        email_dispatched=email_sent,
    )


def list_employees(
    db: Session,
    current_user: User,
    q: Optional[str] = None,
    department_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> EmployeeListResponse:
    """
    Search, filter, and paginate employees.
    Strictly scoped: Admin & HR see all; Employee sees only their own profile.
    """
    query = db.query(Employee).join(User, Employee.user_id == User.id)

    # Server-Side Data Scoping
    user_role = (current_user.role or "").capitalize()
    if user_role == "Employee":
        query = query.filter(Employee.user_id == current_user.id)
    else:
        # HR and Admin can search and filter
        if q:
            search = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    Employee.full_name.ilike(search),
                    Employee.employee_code.ilike(search),
                    User.email.ilike(search),
                    Employee.phone.ilike(search),
                )
            )
        if department_id:
            query = query.filter(Employee.department_id == department_id)
        if status_filter:
            query = query.filter(Employee.status == status_filter)

    total = query.count()
    offset = (page - 1) * limit
    employees = query.order_by(Employee.id.desc()).offset(offset).limit(limit).all()

    items = [_format_employee_out(e) for e in employees]
    return EmployeeListResponse(
        total=total,
        page=page,
        limit=limit,
        items=items,
    )


def get_employee_360_profile(
    db: Session,
    current_user: User,
    employee_id: int,
) -> Employee360Profile:
    """
    Returns full Employee 360 profile (personal info, salary structure,
    attendance summary, leave balance breakdown, and payslip history).
    Strictly scoped by role!
    """
    emp = enforce_employee_scope(employee_id, current_user, db)

    # 1. Salary breakdown
    basic = emp.basic_salary or 0.0
    hra = round(basic * 0.40, 2)
    medical = round(basic * 0.10, 2)
    gross = round(basic + hra + medical, 2)
    salary_breakdown = SalaryBreakdown(
        basic_salary=basic,
        hra_estimate=hra,
        medical_estimate=medical,
        gross_salary_estimate=gross,
    )

    # 2. Attendance summary
    attendances = db.query(Attendance).filter(Attendance.employee_id == emp.id).all()
    present_cnt = sum(1 for a in attendances if a.status == "present")
    late_cnt = sum(1 for a in attendances if a.status == "late")
    half_cnt = sum(1 for a in attendances if a.status == "half_day")
    absent_cnt = sum(1 for a in attendances if a.status == "absent")
    work_hrs = sum(a.work_hours or 0.0 for a in attendances)

    attendance_summary = AttendanceSummary(
        total_days_logged=len(attendances),
        present_days=present_cnt,
        late_days=late_cnt,
        half_days=half_cnt,
        absent_days=absent_cnt,
        total_work_hours=round(work_hrs, 2),
    )

    # 3. Leave balances
    settings = get_company_settings(db)
    annual_quota = settings.annual_leave_quota or 14
    sick_quota = settings.sick_leave_quota or 8
    casual_quota = settings.casual_leave_quota or 10

    approved_leaves = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == emp.id, LeaveRequest.status == "Approved")
        .all()
    )

    annual_used = sum(l.working_days for l in approved_leaves if l.leave_type == "Annual")
    sick_used = sum(l.working_days for l in approved_leaves if l.leave_type == "Sick")
    casual_used = sum(l.working_days for l in approved_leaves if l.leave_type == "Casual")
    unpaid_used = sum(l.working_days for l in approved_leaves if l.leave_type == "Unpaid")

    leave_balances = LeaveBalances(
        annual=LeaveTypeBalance(
            quota=annual_quota,
            used=annual_used,
            remaining=max(0, annual_quota - annual_used),
        ),
        sick=LeaveTypeBalance(
            quota=sick_quota,
            used=sick_used,
            remaining=max(0, sick_quota - sick_used),
        ),
        casual=LeaveTypeBalance(
            quota=casual_quota,
            used=casual_used,
            remaining=max(0, casual_quota - casual_used),
        ),
        unpaid_used=unpaid_used,
    )

    # 4. Recent payslips
    payslips = (
        db.query(Payslip)
        .filter(Payslip.employee_id == emp.id)
        .order_by(Payslip.created_at.desc())
        .limit(12)
        .all()
    )
    recent_slips = [
        {
            "id": p.id,
            "payroll_run_id": p.payroll_run_id,
            "month": p.payroll_run.month if p.payroll_run else "",
            "basic_salary": p.basic_salary,
            "gross_salary": p.gross_salary,
            "deductions": p.deductions,
            "net_salary": p.net_salary,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payslips
    ]

    return Employee360Profile(
        profile=_format_employee_out(emp),
        salary_breakdown=salary_breakdown,
        attendance_summary=attendance_summary,
        leave_balances=leave_balances,
        recent_payslips=recent_slips,
    )


def update_employee(
    db: Session,
    current_user: User,
    employee_id: int,
    payload: EmployeeUpdate,
) -> EmployeeOut:
    """
    Updates an employee profile.
    - HR / Admin can edit all job, status, and salary fields.
    - Employee can ONLY update their own phone and address.
    """
    emp = enforce_employee_scope(employee_id, current_user, db)
    user_role = (current_user.role or "").capitalize()

    before_state = {
        "full_name": emp.full_name,
        "phone": emp.phone,
        "address": emp.address,
        "status": emp.status,
        "basic_salary": emp.basic_salary,
    }

    if user_role == "Employee":
        # Strictly restricted to phone and address
        if payload.phone is not None:
            emp.phone = payload.phone
        if payload.address is not None:
            emp.address = payload.address
    else:
        # HR & Admin can update all fields
        if payload.full_name is not None:
            emp.full_name = payload.full_name.strip()
        if payload.phone is not None:
            emp.phone = payload.phone
        if payload.address is not None:
            emp.address = payload.address
        if payload.gender is not None:
            emp.gender = payload.gender
        if payload.department_id is not None:
            dept = db.query(Department).filter(Department.id == payload.department_id).first()
            if not dept:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")
            emp.department_id = payload.department_id
        if payload.designation_id is not None:
            desig = db.query(Designation).filter(Designation.id == payload.designation_id).first()
            if not desig:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found.")
            emp.designation_id = payload.designation_id
        if payload.joining_date is not None:
            emp.joining_date = payload.joining_date
        if payload.exit_date is not None:
            emp.exit_date = payload.exit_date
        if payload.status is not None:
            emp.status = payload.status
        if payload.basic_salary is not None:
            if payload.basic_salary <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Basic salary must be strictly greater than 0.",
                )
            emp.basic_salary = payload.basic_salary

    after_state = {
        "full_name": emp.full_name,
        "phone": emp.phone,
        "address": emp.address,
        "status": emp.status,
        "basic_salary": emp.basic_salary,
    }

    log_audit(
        db=db,
        actor_id=current_user.id,
        action="UPDATE_EMPLOYEE",
        entity="Employee",
        entity_id=emp.id,
        before_json=before_state,
        after_json=after_state,
        commit=False,
    )

    db.commit()
    db.refresh(emp)
    logger.info("Employee %s profile updated by %s", emp.employee_code, current_user.email)
    return _format_employee_out(emp)


# -------------------------------------------------------------
# CSV Dry-Run Import & Export
# -------------------------------------------------------------
def import_employees_csv(
    db: Session,
    actor: User,
    file_bytes: bytes,
    dry_run: bool = True,
) -> CSVImportResponse:
    """
    Parses and validates CSV employee records.
    - Validates required fields, email format, unique codes and emails.
    - Matches department by name.
    - If dry_run=True or errors exist: returns errors without DB mutation.
    - If dry_run=False and 0 errors: bulk inserts employees and user logins.
    """
    try:
        # Load CSV into pandas DataFrame for clean normalization
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid CSV format or corrupted file: {str(e)}",
        )

    # Normalize column names (strip whitespace and lowercase)
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]

    required_cols = ["full_name", "email", "joining_date", "basic_salary"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV file is missing required columns: {', '.join(missing)}",
        )

    errors: List[CSVDryRunError] = []
    validated_rows: List[Dict[str, Any]] = []

    # Pre-fetch existing database emails and employee codes
    existing_emails = set(e[0].lower() for e in db.query(User.email).all())
    existing_codes = set(c[0].upper() for c in db.query(Employee.employee_code).all())

    # Map departments: name.lower() -> id
    departments_map = {d.name.lower(): d.id for d in db.query(Department).all()}
    # Map designations: (dept_id, title.lower()) -> id
    designations_map = {(d.department_id, d.title.lower()): d.id for d in db.query(Designation).all()}

    csv_emails_seen = set()
    csv_codes_seen = set()

    for idx, row in df.iterrows():
        row_num = idx + 2  # 1-based indexing accounting for header row

        # 1. Full Name
        full_name = str(row.get("full_name", "")).strip()
        if not full_name or full_name == "nan":
            errors.append(CSVDryRunError(row=row_num, field="full_name", reason="Full Name is required."))

        # 2. Email validation
        raw_email = str(row.get("email", "")).strip().lower()
        if not raw_email or raw_email == "nan":
            errors.append(CSVDryRunError(row=row_num, field="email", reason="Email address is required."))
        elif not EMAIL_REGEX.match(raw_email):
            errors.append(CSVDryRunError(row=row_num, field="email", reason=f"Invalid email format: '{raw_email}'."))
        elif raw_email in existing_emails:
            errors.append(CSVDryRunError(row=row_num, field="email", reason=f"Email '{raw_email}' already exists in the system."))
        elif raw_email in csv_emails_seen:
            errors.append(CSVDryRunError(row=row_num, field="email", reason=f"Duplicate email '{raw_email}' in CSV."))
        else:
            csv_emails_seen.add(raw_email)

        # 3. Employee Code
        raw_code = str(row.get("employee_code", "")).strip().upper()
        if not raw_code or raw_code == "NAN":
            raw_code = None  # Will auto-generate
        else:
            if raw_code in existing_codes:
                errors.append(CSVDryRunError(row=row_num, field="employee_code", reason=f"Employee code '{raw_code}' already exists in DB."))
            elif raw_code in csv_codes_seen:
                errors.append(CSVDryRunError(row=row_num, field="employee_code", reason=f"Duplicate employee code '{raw_code}' in CSV."))
            else:
                csv_codes_seen.add(raw_code)

        # 4. Department
        dept_name = str(row.get("department", "")).strip()
        dept_id = None
        if dept_name and dept_name.lower() != "nan":
            dept_id = departments_map.get(dept_name.lower())
            if not dept_id:
                errors.append(
                    CSVDryRunError(
                        row=row_num,
                        field="department",
                        reason=f"Department '{dept_name}' not found. Please create it in Organization Setup first.",
                    )
                )

        # 5. Designation (optional)
        desig_title = str(row.get("designation", "")).strip()
        desig_id = None
        if desig_title and desig_title.lower() != "nan" and dept_id:
            desig_id = designations_map.get((dept_id, desig_title.lower()))

        # 6. Joining Date (YYYY-MM-DD)
        raw_date = str(row.get("joining_date", "")).strip()
        parsed_date = None
        try:
            parsed_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
        except Exception:
            errors.append(
                CSVDryRunError(
                    row=row_num,
                    field="joining_date",
                    reason=f"Invalid date format '{raw_date}'. Expected ISO format YYYY-MM-DD.",
                )
            )

        # 7. Basic Salary (> 0)
        raw_salary = row.get("basic_salary")
        parsed_salary = 0.0
        try:
            parsed_salary = float(raw_salary)
            if parsed_salary <= 0:
                errors.append(CSVDryRunError(row=row_num, field="basic_salary", reason="Basic salary must be greater than 0."))
        except Exception:
            errors.append(CSVDryRunError(row=row_num, field="basic_salary", reason="Basic salary must be a valid numeric amount."))

        # Optional fields
        phone = str(row.get("phone", "")).strip() if "phone" in df.columns else None
        phone = None if phone == "nan" else phone

        address = str(row.get("address", "")).strip() if "address" in df.columns else None
        address = None if address == "nan" else address

        gender = str(row.get("gender", "")).strip() if "gender" in df.columns else "Unspecified"
        gender = "Unspecified" if gender == "nan" else gender

        status_val = str(row.get("status", "Active")).strip().capitalize()
        if status_val not in ["Active", "Probation", "Exited"]:
            status_val = "Active"

        if not errors or all(e.row != row_num for e in errors):
            validated_rows.append({
                "full_name": full_name,
                "email": raw_email,
                "employee_code": raw_code,
                "department_id": dept_id,
                "designation_id": desig_id,
                "joining_date": parsed_date,
                "basic_salary": parsed_salary,
                "phone": phone,
                "address": address,
                "gender": gender,
                "status": status_val,
            })

    total_rows = len(df)
    valid_count = len(validated_rows)
    error_count = len(errors)

    # If dry run requested or any validation errors exist, do NOT mutate DB
    if dry_run or error_count > 0:
        logger.info(
            "CSV Dry Run / Validation: total=%s valid=%s errors=%s (dry_run=%s)",
            total_rows,
            valid_count,
            error_count,
            dry_run,
        )
        return CSVImportResponse(
            dry_run=dry_run,
            total_rows=total_rows,
            valid_count=valid_count,
            error_count=error_count,
            errors=errors,
            created_count=0,
            created_employees=None,
        )

    # ---------------------------------------------------------
    # Persist batch import to database
    # ---------------------------------------------------------
    created_list = []
    base_code_index = db.query(Employee).count()

    for idx, item in enumerate(validated_rows):
        emp_code = item["employee_code"] or f"EMP-{3001 + base_code_index + idx}"
        temp_pwd = generate_secure_temporary_password(12)

        user = User(
            email=item["email"],
            password_hash=get_password_hash(temp_pwd),
            role="Employee",
            must_change_password=True,
            is_active=True,
        )
        db.add(user)
        db.flush()

        emp = Employee(
            user_id=user.id,
            employee_code=emp_code,
            full_name=item["full_name"],
            phone=item["phone"],
            address=item["address"],
            gender=item["gender"],
            department_id=item["department_id"],
            designation_id=item["designation_id"],
            joining_date=item["joining_date"],
            status=item["status"],
            basic_salary=item["basic_salary"],
        )
        db.add(emp)
        db.flush()

        # Send welcome email
        send_temporary_password_email(
            to_email=user.email,
            user_name=emp.full_name,
            temp_password=temp_pwd,
            role="Employee",
        )

        created_list.append({
            "employee_id": emp.id,
            "employee_code": emp.employee_code,
            "full_name": emp.full_name,
            "email": user.email,
            "temporary_password": temp_pwd,
        })

    log_audit(
        db=db,
        actor_id=actor.id,
        action="CSV_BULK_IMPORT_EMPLOYEES",
        entity="Employee",
        entity_id=f"batch-{len(created_list)}",
        after_json={"count": len(created_list)},
        commit=False,
    )

    db.commit()
    logger.info("CSV Bulk Import committed: %s employees created by %s", len(created_list), actor.email)

    return CSVImportResponse(
        dry_run=False,
        total_rows=total_rows,
        valid_count=valid_count,
        error_count=0,
        errors=[],
        created_count=len(created_list),
        created_employees=created_list,
    )


def export_employees_to_csv(db: Session, actor: User) -> str:
    """
    Generates a CSV string of all employee directory details.
    """
    employees = db.query(Employee).order_by(Employee.employee_code.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Employee Code",
        "Full Name",
        "Email",
        "Role",
        "Department",
        "Designation",
        "Status",
        "Joining Date",
        "Basic Salary",
        "Phone",
        "Address",
    ])

    for emp in employees:
        writer.writerow([
            emp.employee_code,
            emp.full_name,
            emp.user.email if emp.user else "",
            emp.user.role if emp.user else "Employee",
            emp.department.name if emp.department else "",
            emp.designation.title if emp.designation else "",
            emp.status,
            emp.joining_date.isoformat() if emp.joining_date else "",
            f"{emp.basic_salary:.2f}",
            emp.phone or "",
            emp.address or "",
        ])

    return output.getvalue()
