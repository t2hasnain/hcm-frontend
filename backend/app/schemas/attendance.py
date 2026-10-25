from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel


class CheckInRequest(BaseModel):
    employee_id: Optional[int] = None  # Admin/HR can specify; Employee uses own
    source: str = "web"  # "web" or "camera"
    lat: Optional[float] = None
    lng: Optional[float] = None
    face_verified: bool = False
    faces_detected: int = 1
    accuracy: float = 100.0


class CheckOutRequest(BaseModel):
    employee_id: Optional[int] = None


class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    employee_code: Optional[str] = None
    full_name: Optional[str] = None
    date: date
    check_in: datetime
    check_out: Optional[datetime] = None
    status: str
    work_hours: float
    source: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    face_verified: bool

    class Config:
        from_attributes = True


class CorrectionRequest(BaseModel):
    attendance_id: Optional[int] = None
    employee_id: Optional[int] = None
    date: date
    requested_check_in: Optional[datetime] = None
    requested_check_out: Optional[datetime] = None
    reason: str


class CorrectionDecision(BaseModel):
    status: str  # "Approved" or "Rejected"
    hr_comment: Optional[str] = None


class CorrectionOut(BaseModel):
    id: int
    attendance_id: Optional[int] = None
    employee_id: int
    employee_code: Optional[str] = None
    full_name: Optional[str] = None
    date: date
    requested_check_in: Optional[datetime] = None
    requested_check_out: Optional[datetime] = None
    reason: str
    status: str
    hr_comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[AttendanceOut]


class CorrectionListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[CorrectionOut]
