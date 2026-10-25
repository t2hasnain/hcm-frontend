from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, require_hr_or_admin
from app.models.models import User
from app.services.comms_service import (
    create_announcement,
    delete_announcement,
    list_announcements,
    list_audit_logs,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)

router = APIRouter(prefix="/comms", tags=["M9: Communications & Audit"])


class AnnouncementCreate(BaseModel):
    title: str
    content: str


@router.get("/announcements")
def get_announcements(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all company announcements. Visible to all authenticated users."""
    return list_announcements(db, page, limit)


@router.post("/announcements", status_code=201)
def post_announcement(
    payload: AnnouncementCreate,
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """Create a new company announcement. HR/Admin only."""
    ann = create_announcement(db, current_user, payload.title, payload.content)
    return {
        "id": ann.id,
        "title": ann.title,
        "content": ann.content,
        "posted_by": ann.posted_by,
        "created_at": ann.created_at.isoformat() if ann.created_at else None,
    }


@router.delete("/announcements/{id}")
def remove_announcement(
    id: int,
    current_user: User = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """Delete an announcement. HR/Admin only."""
    return delete_announcement(db, current_user, id)


@router.get("/notifications")
def get_notifications(
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List notifications for the currently authenticated user."""
    data = list_notifications(db, current_user, unread_only, page, limit)
    items = data["items"]
    return {
        "total": data["total"],
        "page": data["page"],
        "limit": data["limit"],
        "items": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
    }


@router.put("/notifications/read-all")
def read_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications for the current user as read."""
    count = mark_all_notifications_read(db, current_user)
    return {"marked_count": count}


@router.put("/notifications/{id}/read")
def read_notification(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read."""
    notif = mark_notification_read(db, current_user, id)
    return {"id": notif.id, "is_read": notif.is_read}


@router.get("/audit-logs")
def get_audit_logs(
    entity: Optional[str] = Query(None),
    actor_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List immutable audit logs. Admin only."""
    data = list_audit_logs(db, entity, actor_id, action, page, limit)
    items = data["items"]
    return {
        "total": data["total"],
        "page": data["page"],
        "limit": data["limit"],
        "items": [
            {
                "id": a.id,
                "actor_id": a.actor_id,
                "action": a.action,
                "entity": a.entity,
                "entity_id": a.entity_id,
                "before_state": a.before_state,
                "after_state": a.after_state,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in items
        ],
    }
