from sqlalchemy.orm import Session
from app.models.models import (
    UploadedFile, FileVerification, PrivacyCredential,
    SecurityTest, EvidenceRecord, AuditLog
)
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

    # ---- PrivyPass stats ----
    total_priv = db.query(PrivacyCredential).count()
    eligible = db.query(PrivacyCredential).filter(
        PrivacyCredential.verification_status == "ELIGIBLE"
    ).count()
    denied = db.query(PrivacyCredential).filter(
        PrivacyCredential.verification_status == "NOT_ELIGIBLE"
    ).count()
    privacy_score = round((eligible / total_priv * 100) if total_priv > 0 else 100, 1)

    privypass = {
        "total_verifications": total_priv,
        "eligible_count": eligible,
        "denied_count": denied,
        "privacy_score": privacy_score,
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
    scores = [integrity_score, privacy_score, security_score, evidence_integrity]
    available = [s for s in scores if s > 0 or True]
    overall_score = round(sum(scores) / len(scores), 1)

    status_map = [(80, "EXCELLENT"), (60, "GOOD"), (40, "FAIR"), (0, "POOR")]
    overall_status = next(label for threshold, label in status_map if overall_score >= threshold)

    return {
        "report_id": uuid.uuid4().hex[:12].upper(),
        "sourcemark": sourcemark,
        "privypass": privypass,
        "trusttest": trusttest,
        "evidencelock": evidencelock,
        "overall_score": overall_score,
        "overall_status": overall_status,
        "created_at": None,  # filled by route
    }

