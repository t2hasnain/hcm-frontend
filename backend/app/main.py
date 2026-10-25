import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import Depends, FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, init_db
from app.routers import (
    auth_router,
    employees_router,
    setup_router,
    attendance_router,
    leave_router,
    payroll_router,
    analytics_router,
    ai_router,
    comms_router,
)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("hcm_lite")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager:
    Initializes database tables and verifies configuration on startup.
    """
    logger.info("Initializing HCM Lite Enterprise Backend...")
    try:
        init_db()
        logger.info("Database schema initialized and synced.")
    except Exception as e:
        logger.critical("Database initialization failed during startup: %s", e)
    yield
    logger.info("Shutting down HCM Lite Enterprise Backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Enterprise AI-assisted Human Capital Management System",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:[0-9]+|https://.*\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under /api/v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(setup_router, prefix=settings.API_V1_STR)
app.include_router(employees_router, prefix=settings.API_V1_STR)
app.include_router(attendance_router, prefix=settings.API_V1_STR)
app.include_router(leave_router, prefix=settings.API_V1_STR)
app.include_router(payroll_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)
app.include_router(comms_router, prefix=settings.API_V1_STR)


@app.get(
    "/",
    tags=["Root"],
    summary="Root Service Info",
    status_code=status.HTTP_200_OK,
)
def root() -> Dict[str, Any]:
    """
    Returns service identification and operational status.
    """
    return {
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "status": "online",
        "api_v1": settings.API_V1_STR,
        "docs": "/docs",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get(
    "/health",
    tags=["Health"],
    summary="Health Check & DB Ping",
    status_code=status.HTTP_200_OK,
)
def health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Performs active database connectivity ping and returns operational health status.
    """
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error("Health check DB ping failed: %s", e)
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "cors_origins": settings.CORS_ORIGINS,
        "azure_openai_deployment": settings.AZURE_OPENAI_DEPLOYMENT_NAME,
        "email_service": "configured" if bool(settings.AZURE_COMMUNICATION_CONNECTION_STRING) else "unconfigured",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
