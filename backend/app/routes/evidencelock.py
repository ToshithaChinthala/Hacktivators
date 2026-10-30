import os
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import EvidenceRecord, AuditLog
from app.services.hashing_service import sha256_bytes
from app.services.audit_service import create_audit_event, verify_audit_chain
from app.services.websocket_manager import ws_manager
from app.core.config import settings
import asyncio

router = APIRouter(prefix="/api/evidencelock", tags=["evidencelock"])

@router.post("/register")
async def register_evidence(
    file: UploadFile = File(...),
    evidence_name: str = Form(...),
    evidence_type: str = Form(default="document"),
    uploaded_by: str = Form(default="admin"),
    db: Session = Depends(get_db),
):
    content = await file.read()
    evidence_hash = sha256_bytes(content)

    dest_dir = os.path.join(settings.UPLOAD_DIR, "evidence")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{evidence_hash[:16]}_{file.filename}")
    with open(dest, "wb") as f:
        f.write(content)

    record = EvidenceRecord(
        evidence_name=evidence_name,
        evidence_type=evidence_type,
        evidence_hash=evidence_hash,
        uploaded_by=uploaded_by,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    audit = create_audit_event(db, "EVIDENCE_REGISTERED", "evidence_record", record.id, uploaded_by)
    asyncio.create_task(ws_manager.broadcast({
        "module": "evidencelock",
        "event": "evidence_registered",
        "evidence_id": record.id,
    }))

    return {
        "id": record.id,
        "evidence_name": record.evidence_name,
        "evidence_hash": record.evidence_hash,
        "evidence_type": record.evidence_type,
        "uploaded_by": record.uploaded_by,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "audit_id": audit.id,
        "message": "Evidence registered and audit entry created.",
    }


@router.get("/records")
def get_records(db: Session = Depends(get_db)):
    records = db.query(EvidenceRecord).order_by(EvidenceRecord.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "evidence_name": r.evidence_name,
            "evidence_type": r.evidence_type,
            "evidence_hash": r.evidence_hash,
            "uploaded_by": r.uploaded_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.asc()).all()
    return [
        {
            "id": l.id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "actor": l.actor,
            "previous_hash": l.previous_hash,
            "current_hash": l.current_hash,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        }
        for l in logs
    ]


@router.post("/verify-chain")
def verify_chain(db: Session = Depends(get_db)):
    return verify_audit_chain(db)

