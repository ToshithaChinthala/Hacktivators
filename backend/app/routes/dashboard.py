from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import (
    UploadedFile, FileVerification,
    SecurityTest, EvidenceRecord, AuditLog, User
)
from app.models.provenance_models import AuditCheckpoint
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total_files = db.query(UploadedFile).filter(UploadedFile.user_id == current_user.id).count()
    verified = (
        db.query(FileVerification)
        .join(UploadedFile, FileVerification.file_id == UploadedFile.id)
        .filter(UploadedFile.user_id == current_user.id, FileVerification.verification_status == "MATCH")
        .count()
    )
    modified = (
        db.query(FileVerification)
        .join(UploadedFile, FileVerification.file_id == UploadedFile.id)
        .filter(UploadedFile.user_id == current_user.id, FileVerification.verification_status == "MISMATCH")
        .count()
    )
    checkpoints_count = db.query(AuditCheckpoint).count()
    sec_tests = db.query(SecurityTest).filter(SecurityTest.user_id == current_user.id).count()
    high_risk = db.query(SecurityTest).filter(
        SecurityTest.user_id == current_user.id,
        SecurityTest.risk_level.in_(["HIGH", "CRITICAL"])
    ).count()
    evidence = db.query(EvidenceRecord).filter(EvidenceRecord.user_id == current_user.id).count()

    # compute user-specific trust score
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
def get_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.actor == current_user.email)
        .order_by(AuditLog.timestamp.desc())
        .limit(20)
        .all()
    )
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
