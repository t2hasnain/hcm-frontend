from app.routers.auth import router as auth_router
from app.routers.employees import router as employees_router
from app.routers.setup import router as setup_router
from app.routers.attendance import router as attendance_router
from app.routers.leave import router as leave_router
from app.routers.payroll import router as payroll_router
from app.routers.analytics import router as analytics_router
from app.routers.ai import router as ai_router
from app.routers.comms import router as comms_router

__all__ = [
    "auth_router",
    "setup_router",
    "employees_router",
    "attendance_router",
    "leave_router",
    "payroll_router",
    "analytics_router",
    "ai_router",
    "comms_router",
]
