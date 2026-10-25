from datetime import date
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User
from app.services.ai_service import run_chat, run_dashboard_summary, run_smart_leave

router = APIRouter(prefix="/ai", tags=["M8: AI Assistant"])


class ChatRequest(BaseModel):
    message: str


class DashboardSummaryRequest(BaseModel):
    kpi_data: Dict[str, Any]


class SmartLeaveRequest(BaseModel):
    natural_text: str
    today_date: Optional[str] = None


@router.post("/chat")
def ai_chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Conversational AI assistant for HCM queries with tool calling."""
    return run_chat(db, current_user, payload.message)


@router.post("/dashboard-summary")
def ai_dashboard_summary(
    payload: DashboardSummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an executive summary from KPI data using AI."""
    summary = run_dashboard_summary(db, current_user, payload.kpi_data)
    return {"summary": summary}


@router.post("/smart-leave")
def ai_smart_leave(
    payload: SmartLeaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parse a natural language leave request into structured leave data."""
    today_str = payload.today_date or date.today().isoformat()
    return run_smart_leave(db, current_user, payload.natural_text, today_str)
