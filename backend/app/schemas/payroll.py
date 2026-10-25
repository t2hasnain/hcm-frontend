import re
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator


class PayrollRunRequest(BaseModel):
    month: str  # YYYY-MM

    @field_validator("month")
    @classmethod
    def validate_month(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{2}$", v):
            raise ValueError("month must be in YYYY-MM format")
        return v


class PayslipOut(BaseModel):
    id: int
    payroll_run_id: int
    employee_id: int
    employee_code: str
    full_name: str
    basic_salary: float
    hra: float
    medical: float
    gross_salary: float
    working_days: int
    absent_days: int
    unpaid_leave_days: int
    half_days: int
    deductions: float
    income_tax: float
    net_salary: float

    class Config:
        from_attributes = True


class PayrollRunOut(BaseModel):
    id: int
    month: str
    status: str
    created_by: Optional[int] = None
    finalized_by: Optional[int] = None
    finalized_at: Optional[datetime] = None
    created_at: datetime
    payslips: List[PayslipOut] = []
    total_gross: float = 0.0
    total_net: float = 0.0
    employee_count: int = 0

    class Config:
        from_attributes = True
