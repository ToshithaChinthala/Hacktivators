"""
ProvenanceGuard Independent Reporting Service.

Generates three separate, professionally formatted security reports:
1. Rollback Detection Report (with prominent simulation distinction)
2. Re-Save Analysis Report (strictly separating exact-byte SHA-256 from content similarity)
3. Signing Key Security Report (zero private key leakage, distinguishing historical validity from signing permissions)

All reports derive ownership from authenticated current_user and display timestamps in IST (Asia/Kolkata).
"""

import io
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from fpdf import FPDF
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import User, UploadedFile
from app.models.provenance_models import KeyRegistry, AuditCheckpoint, SignatureRecord

logger = logging.getLogger(__name__)

# Indian Standard Time (UTC+05:30)
IST_TZ = timezone(timedelta(hours=5, minutes=30))


def get_current_ist_str() -> str:
    """Return formatted timestamp in IST (Asia/Kolkata, UTC+05:30)."""
    return datetime.now(IST_TZ).strftime("%d %b %Y, %I:%M:%S %p IST")


# ══════════════════════════════════════════════════════════════════════════════
# 1. REPORT BUILDERS (Structured Data)
# ══════════════════════════════════════════════════════════════════════════════

def build_rollback_report(data: Dict[str, Any], current_user: User) -> Dict[str, Any]:
    """
    Build structured Rollback Detection Report from actual verification or simulation data.
    """
    if not data:
        raise HTTPException(400, "No rollback verification or simulation data provided.")

    is_sim = bool(data.get("is_simulation", False))
    status = data.get("status", "UNKNOWN")
    rollback_detected = bool(data.get("rollback_detected", False))

    cp_seq = data.get("checkpoint_sequence", 0)
    cp_count = data.get("checkpoint_count", 0)
    current_max_id = data.get("current_max_id", 0)
    current_count = data.get("current_count", 0)
    actual_db_max_id = data.get("actual_db_max_id", current_max_id)
    actual_db_count = data.get("actual_db_count", current_count)

    seq_diff = cp_seq - current_max_id
    count_diff = cp_count - current_count

    # Determine explanation based on authenticity & result
    if is_sim:
        summary_title = "SIMULATION -- NOT A REAL DATABASE ROLLBACK"
        detailed_explanation = (
            f"This is a demonstration of ProvenanceGuard rollback detection. "
            f"An in-memory snapshot was simulated with sequence #{current_max_id} and count {current_count}, "
            f"which is older than the trusted witness checkpoint sequence #{cp_seq}. "
            f"The independent witness file (backend/checkpoints/witness_store.json) correctly exposed "
            f"the {seq_diff}-event gap. ZERO ACTUAL MYSQL RECORDS WERE ALTERED OR DELETED. "
            f"The actual database remains intact at sequence #{actual_db_max_id} ({actual_db_count} entries)."
        )
        security_implications = (
            "If an attacker were to perform an unauthorized database restore to an older snapshot, "
            "the filesystem witness anchor prevents silent deletion of audit trails."
        )
        recommendations = [
            "Simulation completed successfully. Click 'Reset Simulation' to return to standard monitoring.",
            "Verify that backup filesystem witness mirrors are active in production.",
            "Maintain append-only protections on the witness checkpoint storage.",
        ]
    elif rollback_detected:
        summary_title = f"CRITICAL: {status.replace('_', ' ')} DETECTED"
        detailed_explanation = (
            f"The current database sequence #{current_max_id} ({current_count} entries) is less than the "
            f"trusted witness checkpoint sequence #{cp_seq} ({cp_count} entries). "
            f"There is a discrepancy of {seq_diff} missing sequence IDs and {count_diff} missing entries. "
            f"This indicates that the database was restored to an earlier snapshot or recent records were removed."
        )
        security_implications = (
            "Potential unauthorized database rollback or state restoration. "
            "Recent evidence registrations or audit events may have been wiped from MySQL."
        )
        recommendations = [
            "Quarantine database and inspect MySQL binary audit logs for unauthorized snapshot restores.",
            "Compare state against the trusted witness store (backend/checkpoints/witness_store.json).",
            "Audit DBA and database administrative access credentials immediately.",
        ]
    elif status == "INTACT":
        summary_title = "AUDIT CHAIN INTACT -- NO ROLLBACK DETECTED"
        detailed_explanation = (
            f"The database state (highest sequence ID #{current_max_id}, {current_count} entries) "
            f"is consistent with the trusted checkpoint sequence #{cp_seq} ({cp_count} entries). "
            f"The current sequence equals or exceeds the checkpoint sequence, and the cryptographic "
            f"head hash matches the witness store."
        )
        security_implications = (
            "Audit chain continuity is mathematically confirmed. "
            "No silent deletions, snapshot rollbacks, or state rewinds have occurred since the checkpoint."
        )
        recommendations = [
            "Continue periodic checkpoint creation to maintain fresh verification anchors.",
            "Ensure Ed25519 signing keys are active for signing upcoming checkpoints.",
        ]
    else:
        summary_title = f"STATUS: {status}"
        detailed_explanation = data.get("message", "No checkpoint available to verify against.")
        security_implications = "Rollback protection is unanchored until a trusted checkpoint is generated."
        recommendations = ["Create a trusted checkpoint to establish a baseline."]

    report_id = f"REP-RB-{uuid.uuid4().hex[:8].upper()}"

    return {
        "report_id": report_id,
        "report_type": "Rollback Detection Report",
        "generated_at_ist": get_current_ist_str(),
        "generated_by": current_user.email,
        "is_simulation": is_sim,
        "status": status,
        "rollback_detected": rollback_detected,
        "summary_title": summary_title,
        "checkpoint_id": data.get("checkpoint_id") or "N/A",
        "checkpoint_created_at": data.get("checkpoint_created_at") or "N/A",
        "checkpoint_sequence": cp_seq,
        "checkpoint_count": cp_count,
        "checkpoint_head_hash": data.get("checkpoint_head_hash") or "N/A",
        "current_max_id": current_max_id,
        "current_count": current_count,
        "actual_db_max_id": actual_db_max_id,
        "actual_db_count": actual_db_count,
        "seq_diff": seq_diff,
        "count_diff": count_diff,
        "witness_signed": bool(data.get("witness_signed", False)),
        "detailed_explanation": detailed_explanation,
        "security_implications": security_implications,
        "recommendations": recommendations,
    }


def build_resave_report(data: Dict[str, Any], current_user: User, db: Session) -> Dict[str, Any]:
    """
    Build structured Re-Save Analysis Report from actual analysis results.
    Strictly enforces user-wise file authorization.
    """
    if not data:
        raise HTTPException(400, "No re-save analysis result provided.")

    original_file_id = data.get("original_file_id")
    if original_file_id:
        file_rec = db.query(UploadedFile).filter(UploadedFile.id == original_file_id).first()
        if not file_rec or file_rec.user_id != current_user.id:
            raise HTTPException(404, "Registered original file not found in your account.")

    comp = data.get("comparison") or {}
    is_exact = bool(data.get("is_exact_hash_match", False))
    cls = data.get("classification", "UNABLE_TO_DETERMINE")
    cls_label = data.get("classification_label") or cls.replace("_", " ")

    similarity_pct = comp.get("similarity_percentage")
    change_pct = comp.get("change_percentage")

    # Dual-layer verification assessment
    if is_exact:
        layer1_text = "PASSED: Bit-for-bit exact SHA-256 match. Files are cryptographically identical."
        resave_consistency = "Identical file copy. Perfect cryptographic integrity."
    else:
        layer1_text = "FAILED: SHA-256 hashes differ. Byte-level divergence confirmed."
        if cls in ("CONTENT_SIMILAR", "POSSIBLE_DERIVATIVE"):
            resave_consistency = (
                f"Findings are consistent with a legitimate re-save, export, or slight formatting modification "
                f"({similarity_pct:.2f}% content similarity). Content is largely intact despite byte changes."
            )
        elif cls == "CONTENT_MODIFIED":
            resave_consistency = (
                f"Significant substantive alterations detected ({change_pct:.2f}% change). "
                f"Findings suggest material edits rather than a simple metadata-only re-save."
            )
        else:
            resave_consistency = "Inconclusive. Content difference cannot be confirmed as a benign re-save."

    detailed_diffs = []
    if comp.get("added"):
        detailed_diffs.append(f"+ Added items ({len(comp['added'])})")
    if comp.get("removed"):
        detailed_diffs.append(f"- Removed items ({len(comp['removed'])})")
    if comp.get("modified"):
        detailed_diffs.append(f"~ Modified sections ({len(comp['modified'])})")

    structural = comp.get("structural_details") or {}
    if structural.get("slide_details"):
        slides_count = len(structural["slide_details"])
        detailed_diffs.append(f"Presentation slides analyzed: {slides_count} slides")

    report_id = f"REP-RS-{uuid.uuid4().hex[:8].upper()}"

    return {
        "report_id": report_id,
        "report_type": "Re-Save & Derivative Analysis Report",
        "generated_at_ist": get_current_ist_str(),
        "generated_by": current_user.email,
        "original_filename": data.get("original_filename") or "Unknown",
        "new_filename": data.get("new_filename") or "Unknown",
        "original_file_size": data.get("original_file_size", 0),
        "new_file_size": data.get("new_file_size", 0),
        "original_hash": data.get("original_hash") or "N/A",
        "new_hash": data.get("new_hash") or "N/A",
        "is_exact_hash_match": is_exact,
        "layer1_assessment": layer1_text,
        "layer2_similarity_pct": similarity_pct,
        "layer2_change_pct": change_pct,
        "comparison_method": comp.get("comparison_method") or "Cryptographic Comparison",
        "classification": cls,
        "classification_label": cls_label,
        "explanation": data.get("classification_explanation") or "Analysis completed.",
        "resave_consistency": resave_consistency,
        "detected_differences": detailed_diffs,
        "recommendations": [
            "Treat SHA-256 mismatch as conclusive proof that file bytes were altered.",
            "If changes are legitimate and approved, register as an authorized derivative.",
            "Do not rely solely on visual or textual appearance for strict evidentiary verification.",
        ],
    }


def build_keys_report(data: Dict[str, Any], current_user: User, db: Session) -> Dict[str, Any]:
    """
    Build structured Signing Key Security Report.
    Guarantees ZERO exposure of private keys or secrets.
    Accurately reports active, rotated, or revoked lifecycle state.
    """
    if not data:
        raise HTTPException(400, "No key or signature verification data provided.")

    key_id = data.get("key_id")
    if not key_id:
        raise HTTPException(400, "key_id is required for Signing Key Report.")

    # Query authoritative database record
    key_record = db.query(KeyRegistry).filter(KeyRegistry.key_id == key_id).first()
    if not key_record:
        raise HTTPException(404, f"Signing key {key_id} not found.")

    status = key_record.status
    algorithm = key_record.algorithm or "Ed25519"
    owner = key_record.owner or "TrustSphere AI"

    # Signature verification details (if provided from verify action)
    verify_result = data.get("verification_result") or data.get("verification_status") or "NOT_VERIFIED"
    sig_id = data.get("signature_id") or "N/A"
    msg_hash = data.get("message_hash") or data.get("original_hash") or "N/A"

    # Accurate lifecycle analysis
    is_compromised = (status == "COMPROMISED")
    is_active = (status == "ACTIVE")
    is_rotated = (status == "ROTATED")
    is_revoked = (status == "REVOKED")

    if is_active:
        lifecycle_explanation = "Key is currently ACTIVE and authorized to generate authoritative signatures and checkpoints."
    elif is_rotated:
        lifecycle_explanation = (
            "Key has been ROTATED. It is retired from issuing new signatures. However, historical signatures "
            "issued prior to rotation remain mathematically VALID and verifiable."
        )
    elif is_revoked:
        lifecycle_explanation = (
            f"Key has been REVOKED ({key_record.status_reason or 'No reason provided'}). "
            f"Signatures created after revocation are SUSPECT and must not be trusted."
        )
    elif is_compromised:
        lifecycle_explanation = (
            f"Key was flagged as COMPROMISED. Compromise window: "
            f"{key_record.compromise_window_start or 'N/A'} to {key_record.compromise_window_end or 'Present'}."
        )
    else:
        lifecycle_explanation = f"Key status: {status}."

    report_id = f"REP-SK-{uuid.uuid4().hex[:8].upper()}"

    return {
        "report_id": report_id,
        "report_type": "Signing Key Security Report",
        "generated_at_ist": get_current_ist_str(),
        "generated_by": current_user.email,
        "key_id": key_id,
        "algorithm": algorithm,
        "owner": owner,
        "key_status": status,
        "is_active": is_active,
        "is_rotated": is_rotated,
        "is_revoked": is_revoked,
        "is_compromised": is_compromised,
        "status_reason": key_record.status_reason or "N/A",
        "created_at": key_record.created_at.isoformat() if key_record.created_at else "N/A",
        "rotated_at": key_record.rotated_at.isoformat() if key_record.rotated_at else None,
        "revoked_at": key_record.revoked_at.isoformat() if key_record.revoked_at else None,
        "compromised_at": key_record.compromised_at.isoformat() if key_record.compromised_at else None,
        "signature_id": sig_id,
        "signature_verification": verify_result,
        "message_hash": msg_hash,
        "public_key_fingerprint": key_id,
        "lifecycle_explanation": lifecycle_explanation,
        "security_implications": (
            "Private keys are strictly confined to the backend secure filesystem and HSM boundary. "
            "No private keys or confidential credentials are ever transmitted or exposed."
        ),
        "recommendations": [
            "Rotate active signing keys periodically to limit historical exposure.",
            "Verify that revocations and compromise declarations are immediately propagated to witness stores.",
            "Historical validity must never be conflated with ongoing signing authorization.",
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# 2. PDF GENERATION (FPDF Document Layouts)
# ══════════════════════════════════════════════════════════════════════════════

class EnterpriseReportPDF(FPDF):
    def __init__(self, title_text: str, report_id: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.title_text = title_text
        self.report_id = report_id

    def header(self):
        # Premium Indigo Header Banner
        self.set_fill_color(79, 70, 229)  # #4f46e5 (Indigo)
        self.rect(0, 0, 210, 18, "F")
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 4)
        self.cell(0, 10, f"TRUSTSPHERE AI -- {self.title_text.upper()}", ln=False)
        self.set_text_color(0, 0, 0)
        self.ln(18)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 10, f"TrustSphere AI Enterprise Security | Report ID: {self.report_id} | Page {self.page_no()}", align="C")


def generate_rollback_pdf(report: Dict[str, Any]) -> bytes:
    """Generate professional PDF for Rollback Detection Report."""
    pdf = EnterpriseReportPDF("Rollback Protection Report", report["report_id"])
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    is_sim = report.get("is_simulation", False)
    rollback_detected = report.get("rollback_detected", False)

    # Status Banner
    if is_sim:
        pdf.set_fill_color(254, 243, 199)  # Soft amber
        pdf.set_text_color(180, 83, 9)
        banner_title = "SIMULATION -- NOT A REAL DATABASE ROLLBACK"
    elif rollback_detected:
        pdf.set_fill_color(254, 226, 226)  # Soft rose
        pdf.set_text_color(185, 28, 28)
        banner_title = f"SECURITY ALERT: {report.get('status', 'ROLLBACK_DETECTED')}"
    else:
        pdf.set_fill_color(220, 252, 231)  # Soft emerald
        pdf.set_text_color(21, 128, 61)
        banner_title = "VERIFIED: AUDIT CHAIN INTACT (NO ROLLBACK)"

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 11, banner_title, border=1, ln=True, align="C", fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    # Metadata Header
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(40, 6, "Report ID:", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(55, 6, report["report_id"], border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Generation Date (IST):", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(50, 6, report["generated_at_ist"], border=0, ln=True)

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(40, 6, "Generated By:", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(55, 6, report["generated_by"], border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Execution Mode:", border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(180, 83, 9 if is_sim else 0)
    pdf.cell(50, 6, "SIMULATION DEMO" if is_sim else "LIVE PRODUCTION AUDIT", border=0, ln=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    # Metrics Comparison Table
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "1. Cryptographic Checkpoint vs. Database State", ln=True)
    pdf.set_fill_color(245, 247, 250)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(65, 6, "Metric Property", border=1, fill=True)
    pdf.cell(65, 6, "Trusted Witness Anchor", border=1, fill=True)
    pdf.cell(60, 6, "Observed Current State", border=1, fill=True, ln=True)

    pdf.set_font("Helvetica", "", 8)
    metrics_rows = [
        ("Anchor / Checkpoint ID", str(report.get("checkpoint_id"))[:35], "MySQL audit_logs"),
        ("Sequence Number (Max ID)", str(report.get("checkpoint_sequence")), str(report.get("current_max_id"))),
        ("Audit Record Count", str(report.get("checkpoint_count")), str(report.get("current_count"))),
        ("Sequence Discrepancy", "Baseline Anchor (0)", f"{report.get('seq_diff', 0)} events"),
        ("Independent Witness File", "backend/checkpoints/witness_store.json", "Preserved outside MySQL"),
    ]
    if is_sim:
        metrics_rows.append(("Actual MySQL Live Max ID", "Untouched Real Records", str(report.get("actual_db_max_id"))))

    for label, w_val, c_val in metrics_rows:
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(65, 6, label, border=1)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(65, 6, w_val, border=1)
        pdf.cell(60, 6, c_val, border=1, ln=True)

    pdf.ln(4)

    # Detailed Explanation
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "2. Technical Finding & Explanation", ln=True)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.multi_cell(0, 4.5, report["detailed_explanation"])
    pdf.ln(3)

    # Security Implications
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "3. Security & Compliance Implications", ln=True)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.multi_cell(0, 4.5, report["security_implications"])
    pdf.ln(3)

    # Recommendations
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "4. Recommended Administrative Actions", ln=True)
    pdf.set_font("Helvetica", "", 8.5)
    for rec in report.get("recommendations", []):
        pdf.cell(0, 5, f"  * {rec}", ln=True)

    return bytes(pdf.output())


def generate_resave_pdf(report: Dict[str, Any]) -> bytes:
    """Generate professional PDF for Re-Save & Derivative Analysis Report."""
    pdf = EnterpriseReportPDF("Re-Save Analysis Report", report["report_id"])
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    is_exact = report.get("is_exact_hash_match", False)

    # Status Banner
    if is_exact:
        pdf.set_fill_color(220, 252, 231)
        pdf.set_text_color(21, 128, 61)
        banner_title = "INTEGRITY VERIFIED: EXACT SHA-256 MATCH (100% IDENTITY)"
    else:
        pdf.set_fill_color(238, 242, 255)  # Soft indigo/lavender
        pdf.set_text_color(67, 56, 202)
        banner_title = f"CLASSIFICATION: {report.get('classification_label', 'DERIVATIVE ANALYZED')}"

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 11, banner_title, border=1, ln=True, align="C", fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    # Metadata Header
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(40, 6, "Report ID:", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(55, 6, report["report_id"], border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Generation Date (IST):", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(50, 6, report["generated_at_ist"], border=0, ln=True)

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(40, 6, "Audited For Account:", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(55, 6, report["generated_by"], border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Similarity Score:", border=0)
    pdf.set_font("Helvetica", "B", 9)
    sim_score = report.get("layer2_similarity_pct")
    pdf.cell(50, 6, f"{sim_score:.2f}%" if sim_score is not None else "N/A", border=0, ln=True)
    pdf.ln(3)

    # Dual-Layer Comparison Table
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "1. Dual-Layer File & Cryptographic Comparison", ln=True)
    pdf.set_fill_color(245, 247, 250)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(50, 6, "Property", border=1, fill=True)
    pdf.cell(70, 6, "Registered Original", border=1, fill=True)
    pdf.cell(70, 6, "Submitted New Version", border=1, fill=True, ln=True)

    rows = [
        ("Filename", report.get("original_filename", "N/A"), report.get("new_filename", "N/A")),
        ("File Size", f"{report.get('original_file_size', 0):,} bytes", f"{report.get('new_file_size', 0):,} bytes"),
        ("SHA-256 (Layer 1 Check)", report.get("original_hash", "N/A")[:38] + "...", report.get("new_hash", "N/A")[:38] + "..."),
        ("Comparison Method", report.get("comparison_method", "Cryptographic"), "Perceptual & Structural Analysis"),
    ]
    for label, orig_val, new_val in rows:
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(50, 6, label, border=1)
        pdf.set_font("Helvetica", "", 7.5 if "SHA" in label else 8)
        pdf.cell(70, 6, str(orig_val)[:42], border=1)
        pdf.cell(70, 6, str(new_val)[:42], border=1, ln=True)

    pdf.ln(4)

    # Layer 1 vs Layer 2 Assessment
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "2. Cryptographic Integrity vs. Content Similarity Assessment", ln=True)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.cell(0, 5, f"Layer 1 (Exact-Byte Integrity): {report.get('layer1_assessment')}", ln=True)
    pdf.cell(0, 5, f"Layer 2 (Content Similarity Assessment): {report.get('resave_consistency')}", ln=True)
    pdf.ln(2)

    # Structural Differences
    diffs = report.get("detected_differences", [])
    if diffs:
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Detected Structural Variations:", ln=True)
        pdf.set_font("Helvetica", "", 8)
        for d in diffs:
            pdf.cell(0, 4.5, f"  * {d}", ln=True)
        pdf.ln(2)

    # Explanation
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "3. Explanation & Re-Save Context", ln=True)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.multi_cell(0, 4.5, report.get("explanation", "Analysis completed."))
    pdf.ln(3)

    # Recommendations
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "4. Recommended Actions", ln=True)
    pdf.set_font("Helvetica", "", 8.5)
    for rec in report.get("recommendations", []):
        pdf.cell(0, 5, f"  * {rec}", ln=True)

    return bytes(pdf.output())


def generate_keys_pdf(report: Dict[str, Any]) -> bytes:
    """Generate professional PDF for Signing Key Security Report."""
    pdf = EnterpriseReportPDF("Signing Key Security Report", report["report_id"])
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    status = report.get("key_status", "UNKNOWN")
    sig_ver = report.get("signature_verification", "NOT_VERIFIED")

    # Status Banner
    if status == "COMPROMISED" or sig_ver in ("INVALID_SIGNATURE", "SIGNED_AFTER_REVOCATION"):
        pdf.set_fill_color(254, 226, 226)
        pdf.set_text_color(185, 28, 28)
        banner_title = f"SECURITY ALERT: KEY STATUS {status} / SIGNATURE {sig_ver}"
    elif status == "ROTATED":
        pdf.set_fill_color(243, 244, 246)
        pdf.set_text_color(75, 85, 99)
        banner_title = "KEY STATUS: ROTATED (HISTORICAL VERIFICATION ACTIVE)"
    else:
        pdf.set_fill_color(220, 252, 231)
        pdf.set_text_color(21, 128, 61)
        banner_title = f"KEY STATUS: {status} | ALGORITHM {report.get('algorithm', 'Ed25519')}"

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 11, banner_title, border=1, ln=True, align="C", fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    # Metadata Header
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(40, 6, "Report ID:", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(55, 6, report["report_id"], border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Generation Date (IST):", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(50, 6, report["generated_at_ist"], border=0, ln=True)

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(40, 6, "Audited Key ID:", border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(55, 6, report["key_id"], border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Key Owner / Issuer:", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(50, 6, report.get("owner", "TrustSphere AI"), border=0, ln=True)
    pdf.ln(3)

    # Key Lifecycle Table
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "1. Key Lifecycle & Cryptographic Parameters", ln=True)
    pdf.set_fill_color(245, 247, 250)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(70, 6, "Lifecycle Parameter", border=1, fill=True)
    pdf.cell(120, 6, "Authoritative Registry Value", border=1, fill=True, ln=True)

    k_rows = [
        ("Cryptographic Algorithm", report.get("algorithm", "Ed25519")),
        ("Current Status", report.get("key_status", "UNKNOWN")),
        ("Status Reason / Notes", str(report.get("status_reason", "N/A"))[:60]),
        ("Created Timestamp", str(report.get("created_at", "N/A"))[:26]),
        ("Rotated Timestamp", str(report.get("rotated_at") or "Not rotated")[:26]),
        ("Revoked Timestamp", str(report.get("revoked_at") or "Not revoked")[:26]),
        ("Signature Verification Outcome", str(report.get("signature_verification", "N/A"))),
        ("Signature Reference ID", str(report.get("signature_id", "N/A"))),
        ("Private Key Security Boundary", "CONFIDENTIAL: Enclosed in server HSM/filesystem"),
    ]
    for label, val in k_rows:
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(70, 6, label, border=1)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(120, 6, str(val), border=1, ln=True)

    pdf.ln(4)

    # Lifecycle Explanation
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "2. Key Lifecycle & Historical Verification Analysis", ln=True)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.multi_cell(0, 4.5, report.get("lifecycle_explanation", "Standard key state."))
    pdf.ln(3)

    # Confidentiality Assurance
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "3. Confidentiality & HSM Safeguards", ln=True)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.multi_cell(0, 4.5, report.get("security_implications", "Private key materials remain confidential."))
    pdf.ln(3)

    # Recommendations
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "4. Cryptographic Hygiene Recommendations", ln=True)
    pdf.set_font("Helvetica", "", 8.5)
    for rec in report.get("recommendations", []):
        pdf.cell(0, 5, f"  * {rec}", ln=True)

    return bytes(pdf.output())
