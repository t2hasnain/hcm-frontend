from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class CompanySettingsOut(BaseModel):
    id: int
    company_name: str
    logo_url: Optional[str] = None
    office_start_time: str
    grace_minutes: int
    half_day_hours: float
    weekend_days: List[str]
    office_lat: Optional[float] = None
    office_lng: Optional[float] = None
    geofence_radius_m: float
    annual_leave_quota: int
    sick_leave_quota: int
    casual_leave_quota: int
    admin_allowed_ips: Optional[List[str]] = None
    hr_allowed_ips: Optional[List[str]] = None
    employee_allowed_ips: Optional[List[str]] = None
    ip_restrictions_enabled: bool = False
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    office_start_time: Optional[str] = Field(None, description="HH:MM 24hr format")
    grace_minutes: Optional[int] = Field(None, ge=0, le=120)
    half_day_hours: Optional[float] = Field(None, ge=1.0, le=12.0)
    weekend_days: Optional[List[str]] = None
    office_lat: Optional[float] = None
    office_lng: Optional[float] = None
    geofence_radius_m: Optional[float] = Field(None, ge=10.0, le=50000.0)
    annual_leave_quota: Optional[int] = Field(None, ge=0)
    sick_leave_quota: Optional[int] = Field(None, ge=0)
    casual_leave_quota: Optional[int] = Field(None, ge=0)
    admin_allowed_ips: Optional[List[str]] = None
    hr_allowed_ips: Optional[List[str]] = None
    employee_allowed_ips: Optional[List[str]] = None
    ip_restrictions_enabled: Optional[bool] = None


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    employee_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class DesignationCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    department_id: int


class DesignationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=100)
    department_id: Optional[int] = None


class DesignationOut(BaseModel):
    id: int
    title: str
    department_id: int
    department_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PublicHolidayCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    date: date


class PublicHolidayUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    date: Optional[date] = None


class PublicHolidayOut(BaseModel):
    id: int
    title: str
    date: date
    created_at: datetime

    class Config:
        from_attributes = True


class CreateHRUserRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = "Unspecified"
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    joining_date: Optional[date] = None
    basic_salary: float = Field(default=60000.0, gt=0)


class HRUserCreatedResponse(BaseModel):
    user_id: int
    employee_id: int
    employee_code: str
    email: str
    full_name: str
    role: str = "HR"
    temporary_password: str
    email_dispatched: bool


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class ResetPasswordResponse(BaseModel):
    user_id: int
    email: str
    temporary_password: str
    email_dispatched: bool
