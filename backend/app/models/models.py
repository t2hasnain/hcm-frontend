from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


class CompanySettings(Base):
    """
    Module 1: Company Profile, Working Hours, Geofencing & Leave Quotas
    """
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False, default="HCM Lite Enterprise")
    logo_url = Column(String(1024), nullable=True)
    office_start_time = Column(String(10), nullable=False, default="09:00")
    grace_minutes = Column(Integer, nullable=False, default=15)
    half_day_hours = Column(Float, nullable=False, default=5.0)
    weekend_days = Column(
        JSON,
        nullable=False,
        default=lambda: ["Saturday", "Sunday"],
    )
    office_lat = Column(Float, nullable=True)
    office_lng = Column(Float, nullable=True)
    geofence_radius_m = Column(Float, nullable=False, default=150.0)
    annual_leave_quota = Column(Integer, nullable=False, default=14)
    sick_leave_quota = Column(Integer, nullable=False, default=8)
    casual_leave_quota = Column(Integer, nullable=False, default=10)
    admin_allowed_ips = Column(JSON, nullable=True, default=list)
    hr_allowed_ips = Column(JSON, nullable=True, default=list)
    employee_allowed_ips = Column(JSON, nullable=True, default=list)
    ip_restrictions_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<CompanySettings id={self.id} company_name={self.company_name}>"


class Department(Base):
    """
    Module 1 / Org Structure: Department
    """
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    designations = relationship(
        "Designation",
        back_populates="department",
        cascade="all, delete-orphan",
    )
    employees = relationship(
        "Employee",
        back_populates="department",
    )

    def __repr__(self) -> str:
        return f"<Department id={self.id} name={self.name}>"


class Designation(Base):
    """
    Module 1 / Org Structure: Job Title / Designation
    """
    __tablename__ = "designations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False, index=True)
    department_id = Column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    department = relationship("Department", back_populates="designations")
    employees = relationship("Employee", back_populates="designation")

    def __repr__(self) -> str:
        return f"<Designation id={self.id} title={self.title} department_id={self.department_id}>"


class PublicHoliday(Base):
    """
    Module 1 / Calendar: Official Public Holidays
    """
    __tablename__ = "public_holidays"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    date = Column(Date, nullable=False, index=True, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<PublicHoliday id={self.id} title={self.title} date={self.date}>"


class User(Base):
    """
    Module 2: User Account & Authentication
    Roles: Admin, HR, Employee
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="Employee")  # Admin, HR, Employee
    must_change_password = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # One-to-one with Employee
    employee = relationship(
        "Employee",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    # User notifications
    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    # Announcements posted by this user
    announcements = relationship(
        "Announcement",
        back_populates="author",
        foreign_keys="[Announcement.posted_by]",
    )
    # Audit actions performed by this user
    audit_logs = relationship(
        "AuditLog",
        back_populates="actor",
        foreign_keys="[AuditLog.actor_id]",
    )
    # AI interactions logged for this user
    ai_logs = relationship(
        "AILog",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"


class Employee(Base):
    """
    Module 2: Employee Profile Details & HR Record
    Status: Active, Probation, Exited
    """
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    employee_code = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    gender = Column(String(20), nullable=True)
    department_id = Column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    designation_id = Column(
        Integer,
        ForeignKey("designations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    joining_date = Column(Date, nullable=False)
    exit_date = Column(Date, nullable=True)
    status = Column(String(50), nullable=False, default="Active")  # Active, Probation, Exited
    basic_salary = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="employee")
    department = relationship("Department", back_populates="employees")
    designation = relationship("Designation", back_populates="employees")
    attendances = relationship(
        "Attendance",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    attendance_corrections = relationship(
        "AttendanceCorrection",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    leave_requests = relationship(
        "LeaveRequest",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    payslips = relationship(
        "Payslip",
        back_populates="employee",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Employee id={self.id} code={self.employee_code} name={self.full_name}>"


class Attendance(Base):
    """
    Module 3: Daily Attendance Record & Geolocation Tracking
    Status: present, late, half_day, absent, missing_checkout
    Source: web, camera
    """
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date = Column(Date, nullable=False, index=True)
    check_in = Column(DateTime(timezone=True), nullable=False)
    check_out = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        String(50),
        nullable=False,
        default="present",
        index=True,
    )  # present, late, half_day, absent, missing_checkout
    work_hours = Column(Float, nullable=False, default=0.0)
    source = Column(String(50), nullable=False, default="web")  # web, camera
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    face_verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    employee = relationship("Employee", back_populates="attendances")
    corrections = relationship(
        "AttendanceCorrection",
        back_populates="attendance",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Attendance id={self.id} employee_id={self.employee_id} date={self.date} status={self.status}>"


class AttendanceCorrection(Base):
    """
    Module 3: Attendance Correction Request
    Status: Pending, Approved, Rejected
    """
    __tablename__ = "attendance_corrections"

    id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(
        Integer,
        ForeignKey("attendances.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date = Column(Date, nullable=False, index=True)
    requested_check_in = Column(DateTime(timezone=True), nullable=True)
    requested_check_out = Column(DateTime(timezone=True), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="Pending", index=True)  # Pending, Approved, Rejected
    hr_comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    attendance = relationship("Attendance", back_populates="corrections")
    employee = relationship("Employee", back_populates="attendance_corrections")

    def __repr__(self) -> str:
        return f"<AttendanceCorrection id={self.id} employee_id={self.employee_id} status={self.status}>"


class LeaveRequest(Base):
    """
    Module 4: Leave Application & Management
    Leave Types: Annual, Sick, Casual, Unpaid
    Status: Pending, Approved, Rejected, Cancelled
    """
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    leave_type = Column(String(50), nullable=False, index=True)  # Annual, Sick, Casual, Unpaid
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False)
    working_days = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(
        String(50),
        nullable=False,
        default="Pending",
        index=True,
    )  # Pending, Approved, Rejected, Cancelled
    hr_comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    employee = relationship("Employee", back_populates="leave_requests")

    def __repr__(self) -> str:
        return f"<LeaveRequest id={self.id} employee_id={self.employee_id} type={self.leave_type} status={self.status}>"


class PayrollRun(Base):
    """
    Module 5: Monthly Payroll Execution Batch
    Status: Draft, Finalized
    Month format: YYYY-MM
    """
    __tablename__ = "payroll_runs"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String(7), unique=True, index=True, nullable=False)  # e.g. "2026-10"
    status = Column(String(50), nullable=False, default="Draft", index=True)  # Draft, Finalized
    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    finalized_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    finalizer = relationship("User", foreign_keys=[finalized_by])
    payslips = relationship(
        "Payslip",
        back_populates="payroll_run",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<PayrollRun id={self.id} month={self.month} status={self.status}>"


class Payslip(Base):
    """
    Module 5: Individual Employee Payslip
    """
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    payroll_run_id = Column(
        Integer,
        ForeignKey("payroll_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    basic_salary = Column(Float, nullable=False, default=0.0)
    hra = Column(Float, nullable=False, default=0.0)
    medical = Column(Float, nullable=False, default=0.0)
    gross_salary = Column(Float, nullable=False, default=0.0)
    working_days = Column(Integer, nullable=False, default=0)
    absent_days = Column(Integer, nullable=False, default=0)
    unpaid_leave_days = Column(Integer, nullable=False, default=0)
    half_days = Column(Integer, nullable=False, default=0)
    deductions = Column(Float, nullable=False, default=0.0)
    income_tax = Column(Float, nullable=False, default=0.0)
    net_salary = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    payroll_run = relationship("PayrollRun", back_populates="payslips")
    employee = relationship("Employee", back_populates="payslips")

    def __repr__(self) -> str:
        return f"<Payslip id={self.id} run_id={self.payroll_run_id} employee_id={self.employee_id} net={self.net_salary}>"


class Announcement(Base):
    """
    Module 6: Company-wide Announcements
    """
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    posted_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    author = relationship("User", back_populates="announcements", foreign_keys=[posted_by])

    def __repr__(self) -> str:
        return f"<Announcement id={self.id} title={self.title} posted_by={self.posted_by}>"


class Notification(Base):
    """
    Module 7: In-App User Notifications
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user_id={self.user_id} read={self.is_read}>"


class AuditLog(Base):
    """
    Module 8: Enterprise Immutable Audit Trail
    Records critical entity mutations with before and after state snapshots.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action = Column(String(100), nullable=False, index=True)  # CREATE, UPDATE, DELETE, APPROVE, REJECT, FINALIZE
    entity = Column(String(100), nullable=False, index=True)  # User, Employee, Attendance, LeaveRequest, PayrollRun, etc.
    entity_id = Column(String(100), nullable=True, index=True)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    actor = relationship("User", back_populates="audit_logs", foreign_keys=[actor_id])

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} actor_id={self.actor_id} action={self.action} entity={self.entity}>"


class AILog(Base):
    """
    Module 9: AI Telemetry & LLM Interaction Logs
    """
    __tablename__ = "ai_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    feature = Column(String(100), nullable=False, index=True)  # natural_query, policy_qa, summary, report
    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="ai_logs")

    def __repr__(self) -> str:
        return f"<AILog id={self.id} user_id={self.user_id} feature={self.feature}>"


class PasswordResetOTP(Base):
    """
    Authentication & Security: 4-digit verification code OTP for password changes and resets
    """
    __tablename__ = "password_reset_otps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    otp_code = Column(String(10), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    attempts_count = Column(Integer, nullable=False, default=0)
    is_used = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<PasswordResetOTP id={self.id} user_id={self.user_id} is_used={self.is_used}>"
