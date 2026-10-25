from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


class EmployeeCreate(BaseModel):
    email: EmailStr
    employee_code: Optional[str] = Field(None, description="Optional custom code. Auto-generated if omitted.")
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = "Unspecified"
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    joining_date: date
    status: str = Field(default="Active", pattern="^(Active|Probation|Exited)$")
    basic_salary: float = Field(..., gt=0, description="Basic salary must be strictly greater than 0")


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    joining_date: Optional[date] = None
    exit_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(Active|Probation|Exited)$")
    basic_salary: Optional[float] = Field(None, gt=0)


class EmployeeOut(BaseModel):
    id: int
    user_id: int
    employee_code: str
    full_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    designation_id: Optional[int] = None
    designation_title: Optional[str] = None
    joining_date: date
    exit_date: Optional[date] = None
    status: str
    basic_salary: float
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EmployeeListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[EmployeeOut]


class EmployeeCreatedResponse(BaseModel):
    employee: EmployeeOut
    temporary_password: str
    email_dispatched: bool


class SalaryBreakdown(BaseModel):
    basic_salary: float
    hra_estimate: float
    medical_estimate: float
    gross_salary_estimate: float


class AttendanceSummary(BaseModel):
    total_days_logged: int
    present_days: int
    late_days: int
    half_days: int
    absent_days: int
    total_work_hours: float


class LeaveTypeBalance(BaseModel):
    quota: int
    used: int
    remaining: int


class LeaveBalances(BaseModel):
    annual: LeaveTypeBalance
    sick: LeaveTypeBalance
    casual: LeaveTypeBalance
    unpaid_used: int


class Employee360Profile(BaseModel):
    profile: EmployeeOut
    salary_breakdown: SalaryBreakdown
    attendance_summary: AttendanceSummary
    leave_balances: LeaveBalances
    recent_payslips: List[Dict[str, Any]]


class CSVDryRunError(BaseModel):
    row: int
    field: str
    reason: str


class CSVImportResponse(BaseModel):
    dry_run: bool
    total_rows: int
    valid_count: int
    error_count: int
    errors: List[CSVDryRunError]
    created_count: int = 0
    created_employees: Optional[List[Dict[str, Any]]] = None
