import sys
import os
import json
from datetime import datetime, date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.core.database import SessionLocal, engine
from app.models.models import (
    Base, User, Employee, CompanySettings, Department, Designation,
    PublicHoliday, Announcement
)

# Ensure tables are created
Base.metadata.create_all(bind=engine)
db = SessionLocal()

if not os.path.exists("seed_data.json"):
    print("No seed_data.json found, skipping restore.")
    sys.exit(0)

with open("seed_data.json", "r") as f:
    data = json.load(f)

# Helper to parse dates
def parse_val(col_type, val):
    if val is None:
        return None
    col_str = str(col_type).lower()
    if "date" in col_str and "time" not in col_str and isinstance(val, str):
        return date.fromisoformat(val[:10])
    if "time" in col_str and isinstance(val, str):
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    return val

model_map = {
    "CompanySettings": CompanySettings,
    "Department": Department,
    "Designation": Designation,
    "PublicHoliday": PublicHoliday,
    "User": User,
    "Employee": Employee,
    "Announcement": Announcement,
}

for model_name, records in data.items():
    model = model_map.get(model_name)
    if not model:
        continue
    existing_count = db.query(model).count()
    if existing_count > 0:
        print(f"{model_name} already has {existing_count} rows, skipping.")
        continue
    print(f"Importing {len(records)} rows into {model_name}...")
    for rec in records:
        inst = model()
        for col in model.__table__.columns:
            if col.name in rec:
                raw = rec[col.name]
                parsed = parse_val(col.type, raw)
                setattr(inst, col.name, parsed)
        db.add(inst)
    db.commit()

print("Data import complete!")
