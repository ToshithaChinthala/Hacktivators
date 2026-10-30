from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import (
    UploadedFile, FileVerification,
    SecurityTest, EvidenceRecord, AuditLog
)
from app.models.provenance_models import AuditCheckpoint

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_files = db.query(UploadedFile).count()
    verified = db.query(FileVerification).filter(FileVerification.verification_status == "MATCH").count()
    modified = db.query(FileVerification).filter(FileVerification.verification_status == "MISMATCH").count()
    checkpoints_count = db.query(AuditCheckpoint).count()
    sec_tests = db.query(SecurityTest).count()
    high_risk = db.query(SecurityTest).filter(
        SecurityTest.risk_level.in_(["HIGH", "CRITICAL"])
    ).count()
    evidence = db.query(EvidenceRecord).count()

    # compute trust score
    scores = []
    if total_files > 0:
        scores.append((verified / total_files) * 100)
    if sec_tests > 0:
        safe = sec_tests - high_risk
        scores.append((safe / sec_tests) * 100)
    trust_score = round(sum(scores) / len(scores)) if scores else 100

    return {
        "total_files": total_files,
        "verified_files": verified,
        "modified_files": modified,
        "checkpoints_count": checkpoints_count,
        "privacy_verifications": 0,
        "security_tests": sec_tests,
        "high_risk_count": high_risk,
        "evidence_records": evidence,
        "trust_score": trust_score,
    }

@router.get("/activity")
def get_activity(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(20).all()
    return [
        {
            "id": l.id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "actor": l.actor,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            "current_hash": l.current_hash,
        }
        for l in logs
    ]

