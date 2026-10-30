from sqlalchemy.orm import Session
from app.models.models import AuditLog
from app.services.hashing_service import build_chain_hash
from datetime import datetime, timezone
import threading

_audit_lock = threading.Lock()

def create_audit_event(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: int,
    actor: str,
) -> AuditLog:
    with _audit_lock:
        # Get last entry for chain linking
        last = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
        previous_hash = last.current_hash if last else None
        now_str = datetime.now(timezone.utc).isoformat()
        current_hash = build_chain_hash(previous_hash, action, entity_type, entity_id, now_str)

        entry = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            actor=actor,
            previous_hash=previous_hash,
            current_hash=current_hash,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry


def verify_audit_chain(db: Session) -> dict:
    logs = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    if not logs:
        return {"chain_valid": True, "message": "No audit entries to verify.", "total_entries": 0}

    violations = []
    for i, log in enumerate(logs):
        expected_prev = logs[i - 1].current_hash if i > 0 else None
        if log.previous_hash != expected_prev:
            violations.append(log.id)

    if violations:
        return {
            "chain_valid": False,
            "message": f"Chain integrity violated at log IDs: {violations}",
            "total_entries": len(logs),
            "violations": violations,
        }

    return {
        "chain_valid": True,
        "message": f"Audit chain verified — {len(logs)} entries intact.",
        "total_entries": len(logs),
    }

