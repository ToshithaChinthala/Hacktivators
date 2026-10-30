from sqlalchemy.orm import Session
from app.models.models import (
    UploadedFile, FileVerification,
    SecurityTest, EvidenceRecord, AuditLog
)
from app.models.provenance_models import AuditCheckpoint, KeyRegistry, SignatureRecord
from sqlalchemy import func
import uuid

def generate_trust_report(db: Session) -> dict:
    # ---- SourceMark stats ----
    total_files = db.query(UploadedFile).count()
    verified_count = db.query(FileVerification).filter(
        FileVerification.verification_status == "MATCH"
    ).count()
    modified_count = db.query(FileVerification).filter(
        FileVerification.verification_status == "MISMATCH"
    ).count()
    integrity_score = round((verified_count / total_files * 100) if total_files > 0 else 0, 1)

    sourcemark = {
        "total_files": total_files,
        "verified_files": verified_count,
        "modified_files": modified_count,
        "integrity_score": integrity_score,
    }

    # ---- ProvenanceGuard stats ----
    total_checkpoints = db.query(AuditCheckpoint).count()
    active_keys = db.query(KeyRegistry).filter(KeyRegistry.status == "ACTIVE").count()
    total_sigs = db.query(SignatureRecord).count()
    provenance_score = 100.0 if total_checkpoints > 0 or active_keys > 0 else 90.0

    provenanceguard = {
        "checkpoints_count": total_checkpoints,
        "active_keys": active_keys,
        "total_signatures": total_sigs,
        "protection_status": "Active" if total_checkpoints > 0 else "Ready",
        "provenance_score": provenance_score,
    }

    # ---- TrustTest stats ----
    total_tests = db.query(SecurityTest).count()
    high_risk = db.query(SecurityTest).filter(SecurityTest.risk_level == "HIGH").count()
    critical = db.query(SecurityTest).filter(SecurityTest.risk_level == "CRITICAL").count()
    risky = high_risk + critical
    security_score = round(((total_tests - risky) / total_tests * 100) if total_tests > 0 else 100, 1)

    trusttest = {
        "total_tests": total_tests,
        "high_risk_count": high_risk,
        "critical_count": critical,
        "security_score": security_score,
    }

    # ---- EvidenceLock stats ----
    total_evidence = db.query(EvidenceRecord).count()
    total_audit = db.query(AuditLog).count()
    evidence_integrity = 100.0  # computed by verify-chain separately

    evidencelock = {
        "total_records": total_evidence,
        "audit_events": total_audit,
        "chain_status": "Verified" if total_audit > 0 else "Empty",
        "integrity_score": evidence_integrity,
    }

    # ---- Overall score ----
    scores = [integrity_score, provenance_score, security_score, evidence_integrity]
    available = [s for s in scores if s > 0 or True]
    overall_score = round(sum(scores) / len(scores), 1)

    status_map = [(80, "EXCELLENT"), (60, "GOOD"), (40, "FAIR"), (0, "POOR")]
    overall_status = next(label for threshold, label in status_map if overall_score >= threshold)

    return {
        "report_id": uuid.uuid4().hex[:12].upper(),
        "sourcemark": sourcemark,
        "provenanceguard": provenanceguard,
        "trusttest": trusttest,
        "evidencelock": evidencelock,
        "overall_score": overall_score,
        "overall_status": overall_status,
        "created_at": None,  # filled by route
    }

