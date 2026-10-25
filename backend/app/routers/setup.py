from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.models import User
from app.utils.imgbb_service import upload_to_imgbb
from app.schemas.setup import (
    CompanySettingsOut,
    CompanySettingsUpdate,
    CreateHRUserRequest,
    DepartmentCreate,
    DepartmentOut,
    DepartmentUpdate,
    DesignationCreate,
    DesignationOut,
    DesignationUpdate,
    HRUserCreatedResponse,
    PublicHolidayCreate,
    PublicHolidayOut,
    PublicHolidayUpdate,
    ResetPasswordResponse,
    UpdateUserStatusRequest,
)
from app.services.setup_service import (
    admin_reset_password,
    create_department,
    create_designation,
    create_hr_user,
    create_public_holiday,
    delete_department,
    delete_designation,
    delete_public_holiday,
    get_company_settings,
    list_departments,
    list_designations,
    list_public_holidays,
    update_company_settings,
    update_department,
    update_designation,
    update_public_holiday,
    update_user_status,
)

router = APIRouter(prefix="/setup", tags=["M2: Organization Setup & Management"])


# -------------------------------------------------------------
# Company Profile & Working Settings
# -------------------------------------------------------------
@router.get(
    "/company",
    response_model=CompanySettingsOut,
    summary="Get Company Settings",
    description="Accessible by Admin, HR, and Employee. Returns office hours, geofence, and leave quotas.",
)
def get_company(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CompanySettingsOut:
    return get_company_settings(db)


@router.put(
    "/company",
    response_model=CompanySettingsOut,
    summary="Update Company Settings",
    description="Admin only. Updates working hours, grace time, geofencing coordinates, and leave quotas.",
)
def update_company(
    payload: CompanySettingsUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> CompanySettingsOut:
    return update_company_settings(db, admin_user, payload)


@router.post(
    "/upload-image",
    summary="Upload Image to ImgBB",
    description="Uploads an image (logo, avatar, asset) to ImgBB API v1 and returns permanent URLs.",
)
async def upload_image_endpoint(
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid image (PNG, JPG, SVG, WebP).",
        )
    content = await file.read()
    if len(content) > 32 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file size exceeds maximum limit of 32MB.",
        )
    try:
        return upload_to_imgbb(file_bytes=content, file_name=file.filename)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


# -------------------------------------------------------------
# Departments
# -------------------------------------------------------------
@router.get(
    "/departments",
    response_model=List[DepartmentOut],
    summary="List Departments",
    description="Accessible by all authenticated users. Lists all departments with employee counts.",
)
def get_departments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    return list_departments(db)


@router.post(
    "/departments",
    response_model=DepartmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Department",
    description="Admin only. Creates a new organizational department.",
)
def add_department(
    payload: DepartmentCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DepartmentOut:
    return create_department(db, admin_user, payload)


@router.put(
    "/departments/{department_id}",
    response_model=DepartmentOut,
    summary="Update Department",
    description="Admin only. Updates department name and description.",
)
def edit_department(
    department_id: int,
    payload: DepartmentUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DepartmentOut:
    return update_department(db, admin_user, department_id, payload)


@router.delete(
    "/departments/{department_id}",
    summary="Delete Department",
    description="Admin only. Removes department if no active employees are assigned.",
)
def remove_department(
    department_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    return delete_department(db, admin_user, department_id)


# -------------------------------------------------------------
# Designations / Job Titles
# -------------------------------------------------------------
@router.get(
    "/designations",
    response_model=List[DesignationOut],
    summary="List Designations",
    description="Accessible by all authenticated users. Filterable by department_id.",
)
def get_designations(
    department_id: Optional[int] = Query(None, description="Filter designations by department"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    return list_designations(db, department_id)


@router.post(
    "/designations",
    response_model=DesignationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Designation",
    description="Admin only. Creates a new job title under a department.",
)
def add_designation(
    payload: DesignationCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return create_designation(db, admin_user, payload)


@router.put(
    "/designations/{designation_id}",
    response_model=DesignationOut,
    summary="Update Designation",
    description="Admin only. Updates job title or moves designation to another department.",
)
def edit_designation(
    designation_id: int,
    payload: DesignationUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return update_designation(db, admin_user, designation_id, payload)


@router.delete(
    "/designations/{designation_id}",
    summary="Delete Designation",
    description="Admin only. Removes a job designation.",
)
def remove_designation(
    designation_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    return delete_designation(db, admin_user, designation_id)


# -------------------------------------------------------------
# Public Holidays
# -------------------------------------------------------------
@router.get(
    "/holidays",
    response_model=List[PublicHolidayOut],
    summary="List Public Holidays",
    description="Accessible by all authenticated users. Optionally filterable by year.",
)
def get_holidays(
    year: Optional[int] = Query(None, description="Filter holidays by calendar year e.g. 2026"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[PublicHolidayOut]:
    return list_public_holidays(db, year)


@router.post(
    "/holidays",
    response_model=PublicHolidayOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add Public Holiday",
    description="Admin only. Registers an official company holiday date.",
)
def add_holiday(
    payload: PublicHolidayCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PublicHolidayOut:
    return create_public_holiday(db, admin_user, payload)


@router.put(
    "/holidays/{holiday_id}",
    response_model=PublicHolidayOut,
    summary="Update Public Holiday",
    description="Admin only. Updates holiday title or date.",
)
def edit_holiday(
    holiday_id: int,
    payload: PublicHolidayUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PublicHolidayOut:
    return update_public_holiday(db, admin_user, holiday_id, payload)


@router.delete(
    "/holidays/{holiday_id}",
    summary="Delete Public Holiday",
    description="Admin only. Removes a public holiday from the calendar.",
)
def remove_holiday(
    holiday_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    return delete_public_holiday(db, admin_user, holiday_id)


# -------------------------------------------------------------
# HR User Creation & User Management
# -------------------------------------------------------------
@router.post(
    "/hr-users",
    response_model=HRUserCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision HR User Login",
    description="Admin only. Creates an HR user login and linked Employee record, generates temporary password, sends email, and returns credentials.",
)
def provision_hr_user(
    payload: CreateHRUserRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> HRUserCreatedResponse:
    return create_hr_user(db, admin_user, payload)


@router.patch(
    "/users/{user_id}/status",
    summary="Toggle User Active Status",
    description="Admin only. Activates or deactivates an employee or HR login.",
)
def change_user_active_status(
    user_id: int,
    payload: UpdateUserStatusRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return update_user_status(db, admin_user, user_id, payload.is_active)


@router.patch(
    "/users/{user_id}/reset-password",
    response_model=ResetPasswordResponse,
    summary="Admin Reset User Password",
    description="Admin only. Resets password for any user, generates a temporary password, forces must_change_password=True, dispatches email, and returns temporary password.",
)
def admin_reset_user_password(
    user_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ResetPasswordResponse:
    return admin_reset_password(db, admin_user, user_id)
