import logging
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import Announcement, AuditLog, Notification, User
from app.utils.audit_service import log_audit

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------

def create_announcement(db: Session, current_user: User, title: str, content: str) -> Announcement:
    ann = Announcement(
        title=title.strip(),
        content=content.strip(),
        posted_by=current_user.id,
    )
    db.add(ann)
    db.flush()

    log_audit(
        db=db,
        actor_id=current_user.id,
        action="CREATE_ANNOUNCEMENT",
        entity="Announcement",
        entity_id=ann.id,
        after_json={"title": title},
        commit=False,
    )

    db.commit()
    db.refresh(ann)
    logger.info("Announcement '%s' created by %s", title, current_user.email)
    return ann


def list_announcements(db: Session, page: int = 1, limit: int = 20):
    total = db.query(Announcement).count()
    offset = (page - 1) * limit
    items = db.query(Announcement).order_by(Announcement.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "items": items}


def delete_announcement(db: Session, current_user: User, announcement_id: int) -> dict:
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    log_audit(
        db=db,
        actor_id=current_user.id,
        action="DELETE_ANNOUNCEMENT",
        entity="Announcement",
        entity_id=ann.id,
        before_json={"title": ann.title},
        commit=False,
    )

    db.delete(ann)
    db.commit()
    return {"detail": f"Announcement '{ann.title}' deleted."}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

def list_notifications(db: Session, current_user: User, unread_only: bool = False, page: int = 1, limit: int = 30):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    total = query.count()
    offset = (page - 1) * limit
    items = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "items": items}


def mark_notification_read(db: Session, current_user: User, notification_id: int) -> Notification:
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


def mark_all_notifications_read(db: Session, current_user: User) -> int:
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return count


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------

def list_audit_logs(
    db: Session,
    entity: Optional[str] = None,
    actor_id: Optional[int] = None,
    action: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
):
    query = db.query(AuditLog)
    if entity:
        query = query.filter(AuditLog.entity == entity)
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    total = query.count()
    offset = (page - 1) * limit
    items = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "items": items}
