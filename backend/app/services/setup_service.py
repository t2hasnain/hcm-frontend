import logging
from datetime import date
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.models import (
    CompanySettings,
    Department,
    Designation,
    Employee,
    PublicHoliday,
    User,
)
from app.schemas.setup import (
    CompanySettingsUpdate,
    CreateHRUserRequest,
    DepartmentCreate,
    DepartmentUpdate,
    DesignationCreate,
    DesignationUpdate,
    HRUserCreatedResponse,
    PublicHolidayCreate,
    PublicHolidayUpdate,
    ResetPasswordResponse,
)
from app.services.auth_service import generate_secure_temporary_password
from app.utils.audit_service import log_audit
from app.utils.email_service import send_temporary_password_email

logger = logging.getLogger(__name__)


# -------------------------------------------------------------
# Company Settings
# -------------------------------------------------------------
def get_company_settings(db: Session) -> CompanySettings:
    company = db.query(CompanySettings).first()
    if not company:
        # Default placeholder if not created yet
        company = CompanySettings(
            company_name="HCM Lite Enterprise",
            office_start_time="09:00",
            grace_minutes=15,
            half_day_hours=5.0,
            weekend_days=["Saturday", "Sunday"],
            geofence_radius_m=150.0,
            annual_leave_quota=14,
            sick_leave_quota=8,
            casual_leave_quota=10,
        )
        db.add(company)
        db.commit()
        db.refresh(company)
    return company


def update_company_settings(
    db: Session,
    actor: User,
    payload: CompanySettingsUpdate,
) -> CompanySettings:
    company = get_company_settings(db)
    before_state = {
        "company_name": company.company_name,
        "office_start_time": company.office_start_time,
        "grace_minutes": company.grace_minutes,
        "geofence_radius_m": company.geofence_radius_m,
    }

    update_dict = payload.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(company, field, value)

    log_audit(
        db=db,
        actor_id=actor.id,
        action="UPDATE",
        entity="CompanySettings",
        entity_id=company.id,
        before_json=before_state,
        after_json=update_dict,
        commit=False,
    )

    db.commit()
    db.refresh(company)
    logger.info("Company settings updated by user %s", actor.email)
    return company


# -------------------------------------------------------------
# Departments CRUD
# -------------------------------------------------------------
def list_departments(db: Session) -> List[Dict[str, Any]]:
    depts = db.query(Department).order_by(Department.name.asc()).all()
    results = []
    for d in depts:
        count = db.query(Employee).filter(Employee.department_id == d.id).count()
        results.append({
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "employee_count": count,
            "created_at": d.created_at,
        })
    return results


def create_department(db: Session, actor: User, payload: DepartmentCreate) -> Department:
    existing = db.query(Department).filter(Department.name.ilike(payload.name.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with name '{payload.name}' already exists.",
        )

    dept = Department(name=payload.name.strip(), description=payload.description)
    db.add(dept)
    db.flush()

    log_audit(
        db=db,
        actor_id=actor.id,
        action="CREATE",
        entity="Department",
        entity_id=dept.id,
        after_json={"name": dept.name, "description": dept.description},
        commit=False,
    )

    db.commit()
    db.refresh(dept)
    return dept


def update_department(
    db: Session,
    actor: User,
    dept_id: int,
    payload: DepartmentUpdate,
) -> Department:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")

    before_state = {"name": dept.name, "description": dept.description}
    if payload.name:
        existing = (
            db.query(Department)
            .filter(Department.name.ilike(payload.name.strip()), Department.id != dept_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another department named '{payload.name}' already exists.",
            )
        dept.name = payload.name.strip()

    if payload.description is not None:
        dept.description = payload.description

    log_audit(
        db=db,
        actor_id=actor.id,
        action="UPDATE",
        entity="Department",
        entity_id=dept.id,
        before_json=before_state,
        after_json={"name": dept.name, "description": dept.description},
        commit=False,
    )

    db.commit()
    db.refresh(dept)
    return dept


def delete_department(db: Session, actor: User, dept_id: int) -> Dict[str, str]:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")

    emp_count = db.query(Employee).filter(Employee.department_id == dept_id).count()
    if emp_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete department with {emp_count} active employees. Reassign employees first.",
        )

    log_audit(
        db=db,
        actor_id=actor.id,
        action="DELETE",
        entity="Department",
        entity_id=dept.id,
        before_json={"name": dept.name},
        commit=False,
    )

    db.delete(dept)
    db.commit()
    return {"message": f"Department '{dept.name}' deleted successfully."}


# -------------------------------------------------------------
# Designations CRUD
# -------------------------------------------------------------
def list_designations(db: Session, department_id: Optional[int] = None) -> List[Dict[str, Any]]:
    query = db.query(Designation)
    if department_id:
        query = query.filter(Designation.department_id == department_id)
    designations = query.order_by(Designation.title.asc()).all()

    results = []
    for des in designations:
        results.append({
            "id": des.id,
            "title": des.title,
            "department_id": des.department_id,
            "department_name": des.department.name if des.department else None,
            "created_at": des.created_at,
        })
    return results


def create_designation(db: Session, actor: User, payload: DesignationCreate) -> Dict[str, Any]:
    dept = db.query(Department).filter(Department.id == payload.department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {payload.department_id} not found.",
        )

    desig = Designation(title=payload.title.strip(), department_id=payload.department_id)
    db.add(desig)
    db.flush()

    log_audit(
        db=db,
        actor_id=actor.id,
        action="CREATE",
        entity="Designation",
        entity_id=desig.id,
        after_json={"title": desig.title, "department_id": desig.department_id},
        commit=False,
    )

    db.commit()
    db.refresh(desig)
    return {
        "id": desig.id,
        "title": desig.title,
        "department_id": desig.department_id,
        "department_name": dept.name,
        "created_at": desig.created_at,
    }


def update_designation(
    db: Session,
    actor: User,
    desig_id: int,
    payload: DesignationUpdate,
) -> Dict[str, Any]:
    desig = db.query(Designation).filter(Designation.id == desig_id).first()
    if not desig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found.")

    before_state = {"title": desig.title, "department_id": desig.department_id}
    if payload.title:
        desig.title = payload.title.strip()
    if payload.department_id:
        dept = db.query(Department).filter(Department.id == payload.department_id).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target department not found.")
        desig.department_id = payload.department_id

    log_audit(
        db=db,
        actor_id=actor.id,
        action="UPDATE",
        entity="Designation",
        entity_id=desig.id,
        before_json=before_state,
        after_json={"title": desig.title, "department_id": desig.department_id},
        commit=False,
    )

    db.commit()
    db.refresh(desig)
    return {
        "id": desig.id,
        "title": desig.title,
        "department_id": desig.department_id,
        "department_name": desig.department.name if desig.department else None,
        "created_at": desig.created_at,
    }


def delete_designation(db: Session, actor: User, desig_id: int) -> Dict[str, str]:
    desig = db.query(Designation).filter(Designation.id == desig_id).first()
    if not desig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found.")

    emp_count = db.query(Employee).filter(Employee.designation_id == desig_id).count()
    if emp_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete designation assigned to {emp_count} employees.",
        )

    log_audit(
        db=db,
        actor_id=actor.id,
        action="DELETE",
        entity="Designation",
        entity_id=desig.id,
        before_json={"title": desig.title},
        commit=False,
    )

    db.delete(desig)
    db.commit()
    return {"message": f"Designation '{desig.title}' deleted successfully."}


# -------------------------------------------------------------
# Public Holidays CRUD
# -------------------------------------------------------------
def list_public_holidays(db: Session, year: Optional[int] = None) -> List[PublicHoliday]:
    query = db.query(PublicHoliday)
    if year:
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        query = query.filter(PublicHoliday.date >= start_date, PublicHoliday.date <= end_date)
    return query.order_by(PublicHoliday.date.asc()).all()


def create_public_holiday(
    db: Session,
    actor: User,
    payload: PublicHolidayCreate,
) -> PublicHoliday:
    existing = db.query(PublicHoliday).filter(PublicHoliday.date == payload.date).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A public holiday already exists on {payload.date}: '{existing.title}'.",
        )

    holiday = PublicHoliday(title=payload.title.strip(), date=payload.date)
    db.add(holiday)
    db.flush()

    log_audit(
        db=db,
        actor_id=actor.id,
        action="CREATE",
        entity="PublicHoliday",
        entity_id=holiday.id,
        after_json={"title": holiday.title, "date": str(holiday.date)},
        commit=False,
    )

    db.commit()
    db.refresh(holiday)
    return holiday


def update_public_holiday(
    db: Session,
    actor: User,
    holiday_id: int,
    payload: PublicHolidayUpdate,
) -> PublicHoliday:
    holiday = db.query(PublicHoliday).filter(PublicHoliday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public holiday not found.")

    before_state = {"title": holiday.title, "date": str(holiday.date)}
    if payload.title:
        holiday.title = payload.title.strip()
    if payload.date:
        existing = (
            db.query(PublicHoliday)
            .filter(PublicHoliday.date == payload.date, PublicHoliday.id != holiday_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another public holiday already exists on {payload.date}.",
            )
        holiday.date = payload.date

    log_audit(
        db=db,
        actor_id=actor.id,
        action="UPDATE",
        entity="PublicHoliday",
        entity_id=holiday.id,
        before_json=before_state,
        after_json={"title": holiday.title, "date": str(holiday.date)},
        commit=False,
    )

    db.commit()
    db.refresh(holiday)
    return holiday


def delete_public_holiday(db: Session, actor: User, holiday_id: int) -> Dict[str, str]:
    holiday = db.query(PublicHoliday).filter(PublicHoliday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public holiday not found.")

    log_audit(
        db=db,
        actor_id=actor.id,
        action="DELETE",
        entity="PublicHoliday",
        entity_id=holiday.id,
        before_json={"title": holiday.title, "date": str(holiday.date)},
        commit=False,
    )

    db.delete(holiday)
    db.commit()
    return {"message": f"Public holiday '{holiday.title}' removed."}


# -------------------------------------------------------------
# HR User Creation & User Management
# -------------------------------------------------------------
def create_hr_user(
    db: Session,
    actor: User,
    payload: CreateHRUserRequest,
) -> HRUserCreatedResponse:
    """
    Creates an HR User login + linked Employee record.
    Generates a temporary password (must_change_password=True).
    Dispatches email via email_service and returns temporary password in response.
    """
    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists.",
        )

    # Generate secure temporary password
    temp_password = generate_secure_temporary_password(12)

    # Create User login
    new_user = User(
        email=payload.email.lower(),
        password_hash=get_password_hash(temp_password),
        role="HR",
        must_change_password=True,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    # Generate next employee code
    total_emps = db.query(Employee).count()
    emp_code = f"HR-{1001 + total_emps}"

    # Create Employee profile
    employee = Employee(
        user_id=new_user.id,
        employee_code=emp_code,
        full_name=payload.full_name,
        phone=payload.phone,
        address=payload.address,
        gender=payload.gender,
        department_id=payload.department_id,
        designation_id=payload.designation_id,
        joining_date=payload.joining_date or date.today(),
        status="Active",
        basic_salary=payload.basic_salary,
    )
    db.add(employee)
    db.flush()

    # Log audit
    log_audit(
        db=db,
        actor_id=actor.id,
        action="CREATE_HR_USER",
        entity="User",
        entity_id=new_user.id,
        after_json={
            "email": new_user.email,
            "role": "HR",
            "employee_code": emp_code,
            "full_name": employee.full_name,
        },
        commit=False,
    )

    db.commit()
    db.refresh(new_user)
    db.refresh(employee)

    # Dispatch email
    email_sent = send_temporary_password_email(
        to_email=new_user.email,
        user_name=employee.full_name,
        temp_password=temp_password,
        role="HR",
    )

    logger.info("HR user %s created by Admin %s. Email dispatched: %s", new_user.email, actor.email, email_sent)

    return HRUserCreatedResponse(
        user_id=new_user.id,
        employee_id=employee.id,
        employee_code=employee.employee_code,
        email=new_user.email,
        full_name=employee.full_name,
        role=new_user.role,
        temporary_password=temp_password,
        email_dispatched=email_sent,
    )


def update_user_status(
    db: Session,
    actor: User,
    target_user_id: int,
    is_active: bool,
) -> Dict[str, Any]:
    """
    Activates or deactivates any login.
    An Admin cannot deactivate their own active account.
    """
    if actor.id == target_user_id and not is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own active Administrator account.",
        )

    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    before_state = {"is_active": target_user.is_active}
    target_user.is_active = is_active

    log_audit(
        db=db,
        actor_id=actor.id,
        action="UPDATE_USER_STATUS",
        entity="User",
        entity_id=target_user.id,
        before_json=before_state,
        after_json={"is_active": is_active},
        commit=False,
    )

    db.commit()
    logger.info("User %s status updated to is_active=%s by %s", target_user.email, is_active, actor.email)
    return {
        "user_id": target_user.id,
        "email": target_user.email,
        "is_active": target_user.is_active,
        "message": f"User account has been {'activated' if is_active else 'deactivated'}.",
    }


def admin_reset_password(
    db: Session,
    actor: User,
    target_user_id: int,
) -> ResetPasswordResponse:
    """
    Admin resets password for any user, generates a new temporary password,
    forces must_change_password=True, dispatches email, and returns temp password.
    """
    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    temp_password = generate_secure_temporary_password(12)
    target_user.password_hash = get_password_hash(temp_password)
    target_user.must_change_password = True

    emp = db.query(Employee).filter(Employee.user_id == target_user.id).first()
    display_name = emp.full_name if emp else target_user.email

    log_audit(
        db=db,
        actor_id=actor.id,
        action="ADMIN_RESET_PASSWORD",
        entity="User",
        entity_id=target_user.id,
        after_json={"must_change_password": True},
        commit=False,
    )

    db.commit()

    email_sent = send_temporary_password_email(
        to_email=target_user.email,
        user_name=display_name,
        temp_password=temp_password,
        role=target_user.role,
    )

    logger.info("Password reset for user %s by Admin %s", target_user.email, actor.email)

    return ResetPasswordResponse(
        user_id=target_user.id,
        email=target_user.email,
        temporary_password=temp_password,
        email_dispatched=email_sent,
    )
