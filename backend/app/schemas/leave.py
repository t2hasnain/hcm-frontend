from datetime import date, datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class LeaveApplyRequest(BaseModel):
    leave_type: str  # Annual, Sick, Casual, Unpaid
    start_date: date
    end_date: date
    reason: str


class LeaveDecisionRequest(BaseModel):
    status: str  # Approved or Rejected
    hr_comment: Optional[str] = None


class LeaveTypeBalance(BaseModel):
    quota: int
    used: int
    remaining: int


class LeaveBalanceResponse(BaseModel):
    employee_id: int
    employee_code: str
    full_name: str
    year: int
    annual: LeaveTypeBalance
    sick: LeaveTypeBalance
    casual: LeaveTypeBalance
    unpaid_used: int


class LeaveOut(BaseModel):
    id: int
    employee_id: int
    employee_code: Optional[str] = None
    full_name: Optional[str] = None
    leave_type: str
    start_date: date
    end_date: date
    working_days: int
    reason: str
    status: str
    hr_comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LeaveListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[LeaveOut]
