import os
import asyncio
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import EvidenceRecord, AuditLog, User
from app.services.hashing_service import sha256_bytes
from app.services.audit_service import create_audit_event, verify_audit_chain
from app.services.websocket_manager import ws_manager
from app.services.auth_service import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/api/evidencelock", tags=["evidencelock"])

IST = ZoneInfo("Asia/Kolkata")


def to_ist_str(dt: Optional[datetime]) -> Optional[str]:
    """Convert UTC/naive datetime to formatted Indian Standard Time string."""
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST).strftime("%d %b %Y, %I:%M:%S %p IST")


def to_ist_iso(dt: Optional[datetime]) -> Optional[str]:
    """Convert datetime to ISO 8601 string with IST +05:30 offset."""
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST).isoformat()


@router.post("/register")
async def register_evidence(
    file: UploadFile = File(...),
    evidence_name: str = Form(...),
    evidence_type: str = Form(default="document"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Register evidence file for the authenticated user.
    Actor identity is derived strictly from the authenticated session (current_user.email / current_user.id).
    Client-supplied actor names are never trusted.
    """
    if not evidence_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Evidence name cannot be empty.",
        )

    content = await file.read()
    evidence_hash = sha256_bytes(content)

    dest_dir = os.path.join(settings.UPLOAD_DIR, "evidence")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{evidence_hash[:16]}_{file.filename}")
    with open(dest, "wb") as f:
        f.write(content)

    # Associate record directly with authenticated user's ID and verified email
    record = EvidenceRecord(
        user_id=current_user.id,
        evidence_name=evidence_name.strip(),
        evidence_type=evidence_type,
        evidence_hash=evidence_hash,
        uploaded_by=current_user.email,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # Append to the global tamper-evident hash chain with verified actor email
    audit = create_audit_event(
        db,
        action="EVIDENCE_REGISTERED",
        entity_type="evidence_record",
        entity_id=record.id,
        actor=current_user.email,
    )

    asyncio.create_task(ws_manager.broadcast({
        "module": "evidencelock",
        "event": "evidence_registered",
        "evidence_id": record.id,
        "actor": current_user.email,
    }))

    return {
        "id": record.id,
        "evidence_name": record.evidence_name,
        "evidence_hash": record.evidence_hash,
        "evidence_type": record.evidence_type,
        "uploaded_by": record.uploaded_by,
        "created_at": to_ist_iso(record.created_at),
        "created_at_ist": to_ist_str(record.created_at),
        "audit_id": audit.id,
        "message": "Evidence registered and audit entry created.",
    }


@router.get("/records")
def get_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return evidence records belonging exclusively to the authenticated user.
    Enforces strict actor isolation.
    """
    records = (
        db.query(EvidenceRecord)
        .filter(EvidenceRecord.user_id == current_user.id)
        .order_by(EvidenceRecord.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "evidence_name": r.evidence_name,
            "evidence_type": r.evidence_type,
            "evidence_hash": r.evidence_hash,
            "uploaded_by": r.uploaded_by,
            "created_at": to_ist_iso(r.created_at),
            "created_at_ist": to_ist_str(r.created_at),
        }
        for r in records
    ]


@router.get("/records/{record_id}")
def get_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a single evidence record by ID.
    Enforces strict ownership check: returns 404 if record doesn't exist
    or does not belong to the authenticated user.
    """
    record = (
        db.query(EvidenceRecord)
        .filter(EvidenceRecord.id == record_id, EvidenceRecord.user_id == current_user.id)
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence record not found.",
        )

    return {
        "id": record.id,
        "evidence_name": record.evidence_name,
        "evidence_type": record.evidence_type,
        "evidence_hash": record.evidence_hash,
        "uploaded_by": record.uploaded_by,
        "created_at": to_ist_iso(record.created_at),
        "created_at_ist": to_ist_str(record.created_at),
    }


@router.get("/history")
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the audit history for the authenticated user's evidence flow.
    Displays events performed by this actor or related to their evidence records.
    Timestamps formatted in Indian Standard Time (IST).
    """
    # Find IDs of evidence owned by this user
    user_evidence_ids = [
        r.id for r in db.query(EvidenceRecord.id).filter(EvidenceRecord.user_id == current_user.id).all()
    ]

    # Query logs corresponding to this user's actions or evidence
    if user_evidence_ids:
        logs = (
            db.query(AuditLog)
            .filter(
                (AuditLog.actor == current_user.email) |
                ((AuditLog.entity_type == "evidence_record") & (AuditLog.entity_id.in_(user_evidence_ids)))
            )
            .order_by(AuditLog.timestamp.asc())
            .all()
        )
    else:
        logs = (
            db.query(AuditLog)
            .filter(AuditLog.actor == current_user.email)
            .order_by(AuditLog.timestamp.asc())
            .all()
        )

    return [
        {
            "id": l.id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "actor": l.actor,
            "previous_hash": l.previous_hash,
            "current_hash": l.current_hash,
            "timestamp": to_ist_iso(l.timestamp),
            "timestamp_ist": to_ist_str(l.timestamp),
        }
        for l in logs
    ]


@router.post("/verify-chain")
def verify_chain(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify the global cryptographic integrity of the audit chain.
    Preserves single-chain immutability across all platform actors.
    """
    result = verify_audit_chain(db)
    now_utc = datetime.now(timezone.utc)
    result["verified_at_ist"] = to_ist_str(now_utc)
    result["verified_by"] = current_user.email
    return result
