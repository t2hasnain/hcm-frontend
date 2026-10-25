import sys
import os
import json
from datetime import datetime, date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.core.database import SessionLocal
from app.models.models import (
    User, Employee, CompanySettings, Department, Designation,
    PublicHoliday, Attendance, LeaveRequest, AttendanceCorrection,
    Payslip, PayrollRun, Announcement, Notification, AuditLog
)

db = SessionLocal()

def serialize(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return obj

def row_to_dict(row):
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        d[col.name] = serialize(val)
    return d

data = {
    "CompanySettings": [row_to_dict(r) for r in db.query(CompanySettings).all()],
    "Department": [row_to_dict(r) for r in db.query(Department).all()],
    "Designation": [row_to_dict(r) for r in db.query(Designation).all()],
    "PublicHoliday": [row_to_dict(r) for r in db.query(PublicHoliday).all()],
    "User": [row_to_dict(r) for r in db.query(User).all()],
    "Employee": [row_to_dict(r) for r in db.query(Employee).all()],
    "Announcement": [row_to_dict(r) for r in db.query(Announcement).all()],
}

with open("seed_data.json", "w") as f:
    json.dump(data, f, indent=2)

print("Exported data to seed_data.json:")
for k, v in data.items():
    print(f"  {k}: {len(v)} records")
