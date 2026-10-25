from datetime import date
from typing import Optional
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_hr_or_admin
from app.models.models import User
from app.schemas.employee import (
    CSVImportResponse,
    Employee360Profile,
    EmployeeCreate,
    EmployeeCreatedResponse,
    EmployeeListResponse,
    EmployeeOut,
    EmployeeUpdate,
)
from app.services.employee_service import (
    create_employee,
    export_employees_to_csv,
    get_employee_360_profile,
    import_employees_csv,
    list_employees,
    update_employee,
)

router = APIRouter(prefix="/employees", tags=["M3: Employees & Directory"])


@router.post(
    "",
    response_model=EmployeeCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Employee",
    description="HR & Admin only. Registers an employee with job details and basic_salary > 0. Creates User login (role=Employee, must_change_password=True), sends email, and returns temporary password.",
)
def register_employee(
    payload: EmployeeCreate,
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
) -> EmployeeCreatedResponse:
    return create_employee(db, current_user, payload)


@router.get(
    "",
    response_model=EmployeeListResponse,
    summary="Search & Filter Employees",
    description="Admin & HR see all employees with search and filters. Employees are strictly scoped to only view their own profile.",
)
def get_employees(
    q: Optional[str] = Query(None, description="Search by name, employee code, email, or phone"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    status: Optional[str] = Query(None, description="Filter by status (Active, Probation, Exited)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Records per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EmployeeListResponse:
    return list_employees(
        db=db,
        current_user=current_user,
        q=q,
        department_id=department_id,
        status_filter=status,
        page=page,
        limit=limit,
    )


@router.get(
    "/csv-export",
    summary="Export Employee Directory to CSV",
    description="HR & Admin only. Streams the complete employee directory as a downloadable CSV.",
)
def export_employees(
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
) -> Response:
    csv_data = export_employees_to_csv(db, current_user)
    filename = f"employees_export_{date.today().isoformat()}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/{employee_id}/360",
    response_model=Employee360Profile,
    summary="Employee 360 Profile",
    description="Returns full 360 degree profile: personal info, salary structure, attendance analytics, leave balance quotas, and recent payslips. Scoped by role: an employee can only view their own 360 profile.",
)
def get_employee_360(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Employee360Profile:
    return get_employee_360_profile(db, current_user, employee_id)


@router.put(
    "/{employee_id}",
    response_model=EmployeeOut,
    summary="Update Employee Profile",
    description="HR & Admin can edit all job, salary, and status fields. Employees can strictly ONLY update their own phone number and address.",
)
def edit_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EmployeeOut:
    return update_employee(db, current_user, employee_id, payload)


@router.post(
    "/csv-import",
    response_model=CSVImportResponse,
    summary="CSV Dry-Run & Bulk Import",
    description="HR & Admin only. Parses uploaded CSV. When dry_run=true or validation errors exist, returns validation errors with zero DB persistence. When dry_run=false and 0 errors, bulk provisions accounts and employees.",
)
async def bulk_import_csv(
    file: UploadFile = File(...),
    dry_run: bool = Query(True, description="When true, performs validation check without saving to database"),
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
) -> CSVImportResponse:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid CSV file (.csv).",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded CSV file is empty.",
        )

    return import_employees_csv(
        db=db,
        actor=current_user,
        file_bytes=file_bytes,
        dry_run=dry_run,
    )
