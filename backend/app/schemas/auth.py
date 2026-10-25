from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class AuthStatusResponse(BaseModel):
    is_initialized: bool


class FirstRunRequest(BaseModel):
    # Primary Admin User Credentials
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=6, description="Admin initial master password")
    admin_name: str = Field(default="System Administrator")
    admin_phone: Optional[str] = None

    # Company Profile & Working Settings
    company_name: str = Field(default="HCM Lite Enterprise")
    logo_url: Optional[str] = None
    office_start_time: str = Field(default="09:00", description="HH:MM 24-hr format")
    grace_minutes: int = Field(default=15, ge=0, le=120)
    half_day_hours: float = Field(default=5.0, ge=1.0, le=12.0)
    weekend_days: List[str] = Field(default=["Saturday", "Sunday"])
    office_lat: Optional[float] = None
    office_lng: Optional[float] = None
    geofence_radius_m: float = Field(default=150.0, ge=10.0, le=50000.0)
    annual_leave_quota: int = Field(default=14, ge=0)
    sick_leave_quota: int = Field(default=8, ge=0)
    casual_leave_quota: int = Field(default=10, ge=0)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    must_change_password: bool
    user_id: int
    email: str
    employee_id: Optional[int] = None
    employee_code: Optional[str] = None
    full_name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)


class RequestOTPRequest(BaseModel):
    email: EmailStr


class VerifyOTPChangePasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=4, max_length=6, description="4-digit verification code")
    new_password: str = Field(..., min_length=6)


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    must_change_password: bool
    created_at: datetime

    class Config:
        from_attributes = True
