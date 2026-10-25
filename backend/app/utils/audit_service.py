import json
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional, Union
from sqlalchemy.orm import Session

from app.models.models import AuditLog

logger = logging.getLogger(__name__)


def _json_serial_fallback(obj: Any) -> Any:
    """
    Fallback converter for objects that are not natively JSON serializable.
    """
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if hasattr(obj, "__dict__"):
        data = dict(obj.__dict__)
        data.pop("_sa_instance_state", None)
        return data
    return str(obj)


def _normalize_state(state: Any) -> Optional[Any]:
    """
    Normalize various state representations (dict, model, string, list) into
    a clean JSON-serializable structure suitable for SQLAlchemy JSON columns.
    """
    if state is None:
        return None

    if isinstance(state, (dict, list)):
        try:
            # Round-trip through json to ensure all nested dates/objects are clean primitives
            serialized = json.dumps(state, default=_json_serial_fallback)
            return json.loads(serialized)
        except Exception as e:
            logger.warning("Failed to normalize state dict/list: %s", e)
            return {"raw": str(state)}

    if isinstance(state, str):
        try:
            return json.loads(state)
        except Exception:
            return {"text": state}

    # SQLAlchemy model instance or arbitrary object
    if hasattr(state, "__dict__"):
        try:
            data = dict(state.__dict__)
            data.pop("_sa_instance_state", None)
            serialized = json.dumps(data, default=_json_serial_fallback)
            return json.loads(serialized)
        except Exception as e:
            logger.warning("Failed to serialize model state: %s", e)
            return {"repr": repr(state)}

    return {"value": str(state)}


def log_audit(
    db: Session,
    actor_id: Optional[int],
    action: str,
    entity: str,
    entity_id: Optional[Union[int, str]],
    before_json: Optional[Any] = None,
    after_json: Optional[Any] = None,
    commit: bool = False,
) -> Optional[AuditLog]:
    """
    Helper function that records every critical mutation to the audit trail.
    
    Args:
        db: Active SQLAlchemy Session
        actor_id: ID of the user performing the mutation (or None for system events)
        action: Verb describing mutation (e.g. 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'FINALIZE')
        entity: Name of the domain entity (e.g. 'Employee', 'PayrollRun', 'LeaveRequest')
        entity_id: Identifier of the affected record
        before_json: State snapshot before mutation
        after_json: State snapshot after mutation
        commit: Whether to commit immediately (defaults to False to participate in caller transaction)
        
    Returns:
        AuditLog instance or None on error
    """
    try:
        norm_before = _normalize_state(before_json)
        norm_after = _normalize_state(after_json)

        audit_entry = AuditLog(
            actor_id=actor_id,
            action=action.upper() if action else "UNKNOWN",
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            before_state=norm_before,
            after_state=norm_after,
        )

        db.add(audit_entry)
        if commit:
            db.commit()
            db.refresh(audit_entry)
        else:
            db.flush()

        logger.info(
            "Audit record registered: action=%s entity=%s entity_id=%s actor_id=%s",
            action,
            entity,
            entity_id,
            actor_id,
        )
        return audit_entry
    except Exception as e:
        logger.error(
            "Failed to record audit log for entity '%s' (action: '%s'): %s",
            entity,
            action,
            e,
            exc_info=True,
        )
        return None
