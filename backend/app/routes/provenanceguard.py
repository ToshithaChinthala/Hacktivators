"""
ProvenanceGuard API routes.
All new endpoints — does NOT modify any existing routes.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.models import UploadedFile, AuditLog, User
from app.services.auth_service import get_current_user
from app.models.provenance_models import (
    KeyRegistry, SignatureRecord, AuditCheckpoint, ProvenanceDerivative
)
from app.services.hashing_service import sha256_bytes
from app.services.audit_service import create_audit_event
from app.services.websocket_manager import ws_manager
from app.services.key_management_service import (
    generate_key_pair,
    get_active_key,
    get_key_by_id,
    rotate_key,
    revoke_key,
    report_compromise,
    sign_message as _sign_raw,
    verify_signature_raw,
)
from app.services.signature_service import sign_data, verify_signature
from app.services.checkpoint_service import (
    create_checkpoint,
    verify_rollback,
    simulate_rollback_verification,
    get_latest_witness,
    get_all_witnesses,
)
from app.services.resave_detection import analyze_resave
from fastapi.responses import StreamingResponse
import io
from app.services.provenance_report_service import (
    build_rollback_report,
    build_resave_report,
    build_keys_report,
    generate_rollback_pdf,
    generate_resave_pdf,
    generate_keys_pdf,
)
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/provenanceguard", tags=["provenanceguard"])


# ══════════════════════════════════════════════════════
# FEATURE A — ROLLBACK PROTECTION & CHECKPOINTS
# ══════════════════════════════════════════════════════

@router.post("/checkpoints/create")
def create_checkpoint_endpoint(
    actor: str = Body(default="system", embed=True),
    db: Session = Depends(get_db),
):
    """Create and sign a new audit-chain checkpoint."""
    try:
        result = create_checkpoint(db, actor=actor)
        if result.get("status") == "CREATED":
            try:
                create_audit_event(db, "CHECKPOINT_CREATED", "audit_checkpoint", None, actor)
            except Exception as e:
                logger.warning(f"Audit event for checkpoint failed: {e}")
        return result
    except Exception as e:
        logger.error(f"Checkpoint creation error: {e}")
        raise HTTPException(500, f"Checkpoint creation failed: {str(e)}")


@router.get("/checkpoints")
def list_checkpoints(db: Session = Depends(get_db)):
    """List all stored checkpoints from MySQL."""
    checkpoints = (
        db.query(AuditCheckpoint)
        .order_by(AuditCheckpoint.id.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "checkpoint_id": c.checkpoint_id,
            "sequence_number": c.sequence_number,
            "chain_head_hash": c.chain_head_hash,
            "chain_entry_count": c.chain_entry_count,
            "signed": c.signed_payload not in (None, "UNSIGNED"),
            "public_key_id": c.public_key_id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in checkpoints
    ]


@router.get("/checkpoints/verify")
def verify_rollback_endpoint(db: Session = Depends(get_db)):
    """
    Compare current audit-chain state against the latest trusted witness checkpoint.
    Returns rollback detection result.
    """
    result = verify_rollback(db)
    if result.get("rollback_detected"):
        try:
            create_audit_event(db, f"ROLLBACK_{result['status']}", "audit_chain", None, "provenanceguard")
        except Exception as e:
            logger.warning(f"Audit event for rollback detection failed: {e}")
    return result


@router.post("/checkpoints/simulate-rollback")
def simulate_rollback_endpoint(db: Session = Depends(get_db)):
    """
    Non-destructively demonstrate rollback attack detection for demonstration.
    Compares simulated older state against the genuine witness store without altering MySQL.
    """
    return simulate_rollback_verification(db)


@router.get("/checkpoints/witness")
def get_witness_store():
    """Return all checkpoints from the independent filesystem witness."""
    return {
        "witnesses": get_all_witnesses(),
        "latest": get_latest_witness(),
        "witness_file_note": (
            "This data comes from backend/checkpoints/witness_store.json — "
            "stored independently of MySQL. It persists even if the database is rolled back."
        ),
    }


# ══════════════════════════════════════════════════════
# FEATURE B — RE-SAVE / DERIVATIVE ANALYSIS
# ══════════════════════════════════════════════════════

@router.post("/analyze-resave")
async def analyze_resave_endpoint(
    file: UploadFile = File(...),
    original_file_id: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a new version of a file and compare it against the registered original.
    Returns classification (EXACT_MATCH / CONTENT_SIMILAR / POSSIBLE_DERIVATIVE /
    CONTENT_MODIFIED / UNABLE_TO_DETERMINE) with detailed comparison.
    Enforces strict user ownership: users can only analyze their own registered files.
    """
    original = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == original_file_id, UploadedFile.user_id == current_user.id)
        .first()
    )
    if not original:
        raise HTTPException(404, f"Registered file ID {original_file_id} not found in your account.")

    if not original.storage_path or not os.path.exists(original.storage_path):
        raise HTTPException(400, "Original file not available on disk for comparison.")

    with open(original.storage_path, "rb") as f:
        orig_bytes = f.read()

    await file.seek(0)
    new_bytes = await file.read()
    new_hash = sha256_bytes(new_bytes)
    orig_hash = original.original_hash.strip().lower()

    try:
        result = analyze_resave(
            orig_bytes=orig_bytes,
            new_bytes=new_bytes,
            orig_name=original.filename,
            new_name=file.filename or original.filename,
            orig_hash=orig_hash,
            new_hash=new_hash,
        )
    except Exception as e:
        logger.error(f"Re-save analysis error: {e}")
        raise HTTPException(500, f"Analysis failed: {str(e)}")

    # Audit event
    try:
        create_audit_event(
            db, "RESAVE_ANALYSIS_PERFORMED", "uploaded_file", original_file_id, "provenanceguard"
        )
    except Exception as e:
        logger.warning(f"Audit event for resave analysis failed: {e}")

    return {
        "original_file_id": original_file_id,
        "original_filename": original.filename,
        "new_filename": file.filename,
        **result,
    }


@router.post("/register-derivative")
async def register_derivative(
    file: UploadFile = File(...),
    original_file_id: int = Form(...),
    relationship_type: str = Form(default="UNKNOWN"),
    authorized_by: Optional[str] = Form(None),
    notes: str = Form(default=""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Register an authorized derivative (resaved/resized/converted) file linked to its original.
    The derivative is stored as a new UploadedFile record with a provenance link.
    Enforces strict user ownership: users can only register derivatives of their own files.
    """
    # Validate relationship_type
    valid_types = {"RESAVE", "RESIZE", "RECOMPRESS", "FORMAT_CONVERT", "UNKNOWN"}
    if relationship_type not in valid_types:
        raise HTTPException(400, f"relationship_type must be one of {valid_types}")

    original = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == original_file_id, UploadedFile.user_id == current_user.id)
        .first()
    )
    if not original:
        raise HTTPException(404, f"Original file ID {original_file_id} not found in your account.")

    await file.seek(0)
    content = await file.read()
    new_hash = sha256_bytes(content)

    # Check if this derivative already registered
    existing = db.query(UploadedFile).filter(UploadedFile.original_hash == new_hash).first()
    if existing:
        raise HTTPException(400, f"This file is already registered (ID: {existing.id}).")

    from app.core.config import settings
    dest_dir = os.path.join(settings.UPLOAD_DIR, "sourcemark")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{new_hash[:16]}_{file.filename}")
    with open(dest, "wb") as f2:
        f2.write(content)

    deriv_file = UploadedFile(
        user_id=current_user.id,
        filename=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        storage_path=dest,
        original_hash=new_hash,
    )
    db.add(deriv_file)
    db.flush()

    # Run analysis for the derivative record
    if original.storage_path and os.path.exists(original.storage_path):
        with open(original.storage_path, "rb") as f3:
            orig_bytes = f3.read()
        try:
            analysis = analyze_resave(
                orig_bytes=orig_bytes,
                new_bytes=content,
                orig_name=original.filename,
                new_name=file.filename,
                orig_hash=original.original_hash,
                new_hash=new_hash,
            )
            sim_pct = analysis["comparison"].get("similarity_percentage", 0.0)
            classification = analysis.get("classification", "UNKNOWN")
            comp_method = analysis["comparison"].get("comparison_method", "Unknown")
        except Exception:
            sim_pct = None
            classification = "UNABLE_TO_DETERMINE"
            comp_method = "Error"
    else:
        sim_pct = None
        classification = "UNKNOWN"
        comp_method = "Not available"

    link = ProvenanceDerivative(
        original_file_id=original_file_id,
        derivative_file_id=deriv_file.id,
        relationship_type=relationship_type,
        similarity_percentage=sim_pct,
        comparison_method=comp_method,
        classification=classification,
        authorized_by=current_user.email,
        notes=notes,
    )
    db.add(link)
    db.commit()
    db.refresh(deriv_file)
    db.refresh(link)

    create_audit_event(
        db, "DERIVATIVE_REGISTERED", "provenance_derivative", link.id, authorized_by
    )

    return {
        "derivative_file_id": deriv_file.id,
        "original_file_id": original_file_id,
        "derivative_hash": new_hash,
        "relationship_type": relationship_type,
        "classification": classification,
        "similarity_percentage": sim_pct,
        "authorized_by": authorized_by,
        "message": "Derivative file registered and linked to original.",
    }


@router.get("/derivatives/{file_id}")
def get_derivatives(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all registered derivatives of a given original file belonging to the user."""
    original = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == file_id, UploadedFile.user_id == current_user.id)
        .first()
    )
    if not original:
        raise HTTPException(404, f"File ID {file_id} not found in your account.")

    derivs = (
        db.query(ProvenanceDerivative)
        .filter(ProvenanceDerivative.original_file_id == file_id)
        .order_by(ProvenanceDerivative.created_at.desc())
        .all()
    )

    return {
        "original_file_id": file_id,
        "original_filename": original.filename,
        "original_hash": original.original_hash,
        "derivatives": [
            {
                "id": d.id,
                "derivative_file_id": d.derivative_file_id,
                "relationship_type": d.relationship_type,
                "classification": d.classification,
                "similarity_percentage": d.similarity_percentage,
                "comparison_method": d.comparison_method,
                "authorized_by": d.authorized_by,
                "notes": d.notes,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in derivs
        ],
    }


# ══════════════════════════════════════════════════════
# FEATURE C — SIGNING KEY LIFECYCLE MANAGEMENT
# ══════════════════════════════════════════════════════

@router.get("/keys")
def list_keys(db: Session = Depends(get_db)):
    """List all keys (public info only — private keys never exposed)."""
    keys = db.query(KeyRegistry).order_by(KeyRegistry.id.desc()).all()
    return [_key_to_dict(k) for k in keys]


@router.post("/keys/generate")
def generate_key_endpoint(
    owner: str = Body(default="TrustSphere AI", embed=True),
    db: Session = Depends(get_db),
):
    """Generate a new Ed25519 key pair. Private key stored on filesystem ONLY."""
    # Deactivate warning: no limit on number of keys, but only ACTIVE key signs
    try:
        key = generate_key_pair(owner=owner, db=db)
        create_audit_event(db, "KEY_GENERATED", "key_registry", key.id, owner)
        return {
            "message": f"Key {key.key_id} generated successfully.",
            "key": _key_to_dict(key),
            "security_note": (
                "Private key is stored ONLY on the server filesystem. "
                "It will never be returned by any API. "
                "For production, use an HSM or external secrets manager."
            ),
        }
    except Exception as e:
        raise HTTPException(500, f"Key generation failed: {str(e)}")


@router.post("/keys/rotate")
def rotate_key_endpoint(
    key_id: str = Body(..., embed=True),
    new_owner: str = Body(default=None, embed=True),
    db: Session = Depends(get_db),
):
    """Rotate a key: mark current as ROTATED, generate new ACTIVE key."""
    key_rec = get_key_by_id(key_id, db)
    if not key_rec:
        raise HTTPException(404, f"Key {key_id} not found.")
    owner = new_owner or key_rec.owner
    try:
        old, new = rotate_key(key_id, owner, db)
        create_audit_event(db, "KEY_ROTATED", "key_registry", old.id, owner)
        return {
            "message": f"Key rotated. {key_id} → {new.key_id}",
            "old_key": _key_to_dict(old),
            "new_key": _key_to_dict(new),
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Key rotation failed: {str(e)}")


@router.post("/keys/revoke")
def revoke_key_endpoint(
    key_id: str = Body(..., embed=True),
    reason: str = Body(default="Revoked by administrator", embed=True),
    db: Session = Depends(get_db),
):
    """Revoke a key. Prevents all future signing with this key."""
    try:
        key = revoke_key(key_id, reason, db)
        create_audit_event(db, "KEY_REVOKED", "key_registry", key.id, "admin")
        return {
            "message": f"Key {key_id} has been revoked.",
            "key": _key_to_dict(key),
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Key revocation failed: {str(e)}")


@router.post("/keys/report-compromise")
def report_compromise_endpoint(
    key_id: str = Body(..., embed=True),
    reason: str = Body(default="Key compromise reported", embed=True),
    window_start: Optional[str] = Body(default=None, embed=True),
    window_end: Optional[str] = Body(default=None, embed=True),
    db: Session = Depends(get_db),
):
    """
    Report a key as compromised with an optional compromise time window.
    Signatures within this window will be flagged POSSIBLY_COMPROMISED.
    """
    def parse_dt(s):
        if not s:
            return None
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None

    ws = parse_dt(window_start)
    we = parse_dt(window_end)

    try:
        key = report_compromise(key_id, reason, ws, we, db)
        create_audit_event(db, "KEY_COMPROMISE_REPORTED", "key_registry", key.id, "security")
        return {
            "message": f"Key {key_id} marked as COMPROMISED.",
            "key": _key_to_dict(key),
            "compromise_window": {
                "start": ws.isoformat() if ws else None,
                "end": we.isoformat() if we else None,
            },
            "warning": (
                "Historical signatures created during the compromise window "
                "will be flagged as POSSIBLY_COMPROMISED during verification. "
                "Signatures created before the window remain VALID (if crypto verifies). "
                "Signatures created after revocation are flagged SIGNED_AFTER_REVOCATION."
            ),
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Compromise report failed: {str(e)}")


@router.post("/keys/sign")
def sign_data_endpoint(
    message: str = Body(..., embed=True),
    entity_type: Optional[str] = Body(default=None, embed=True),
    entity_id: Optional[int] = Body(default=None, embed=True),
    actor: str = Body(default="user", embed=True),
    key_id: Optional[str] = Body(default=None, embed=True),
    db: Session = Depends(get_db),
):
    """Sign a message string with the active (or specified) signing key."""
    try:
        sig = sign_data(
            data=message.encode("utf-8"),
            entity_type=entity_type,
            entity_id=entity_id,
            actor=actor,
            db=db,
            key_id=key_id,
        )
        create_audit_event(db, "SIGNATURE_CREATED", "signature_record", sig.id, actor)
        return {
            "signature_id": sig.signature_id,
            "key_id": sig.key_id,
            "message_hash": sig.message_hash,
            "signed_at": sig.signed_at.isoformat() if sig.signed_at else None,
            "message": "Message signed successfully. Use /keys/verify to verify.",
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Signing failed: {str(e)}")


@router.post("/keys/verify")
def verify_signature_endpoint(
    signature_id: str = Body(..., embed=True),
    original_message: Optional[str] = Body(default=None, embed=True),
    db: Session = Depends(get_db),
):
    """
    Verify a stored signature. Returns lifecycle-aware verification result.
    Provide original_message to enable cryptographic verification.
    """
    data = original_message.encode("utf-8") if original_message else None
    result = verify_signature(signature_id, data, db)

    try:
        sig = db.query(SignatureRecord).filter(
            SignatureRecord.signature_id == signature_id
        ).first()
        if sig:
            create_audit_event(db, "SIGNATURE_VERIFIED", "signature_record", sig.id, "provenanceguard")
    except Exception:
        pass

    return result


@router.get("/signatures")
def list_signatures(db: Session = Depends(get_db)):
    """List all signature records."""
    sigs = db.query(SignatureRecord).order_by(SignatureRecord.id.desc()).limit(50).all()
    return [
        {
            "signature_id": s.signature_id,
            "key_id": s.key_id,
            "message_hash": s.message_hash,
            "entity_type": s.entity_type,
            "entity_id": s.entity_id,
            "actor": s.actor,
            "signed_at": s.signed_at.isoformat() if s.signed_at else None,
        }
        for s in sigs
    ]


# ──────────────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────────────

def _key_to_dict(k: KeyRegistry) -> dict:
    return {
        "key_id": k.key_id,
        "owner": k.owner,
        "algorithm": k.algorithm,
        "status": k.status,
        "status_reason": k.status_reason,
        "created_at": k.created_at.isoformat() if k.created_at else None,
        "activated_at": k.activated_at.isoformat() if k.activated_at else None,
        "rotated_at": k.rotated_at.isoformat() if k.rotated_at else None,
        "revoked_at": k.revoked_at.isoformat() if k.revoked_at else None,
        "compromised_at": k.compromised_at.isoformat() if k.compromised_at else None,
        "compromise_window_start": (
            k.compromise_window_start.isoformat() if k.compromise_window_start else None
        ),
        "compromise_window_end": (
            k.compromise_window_end.isoformat() if k.compromise_window_end else None
        ),
        # Public key is safe to expose (it's a PUBLIC key)
        "public_key_pem": k.public_key_pem,
        # Private key: NEVER returned
        "private_key": "[stored securely on server filesystem — never exposed via API]",
    }



# ══════════════════════════════════════════════════════
# PROVENANCEGUARD INDEPENDENT REPORTS (ROLLBACK, RESAVE, KEYS)
# ══════════════════════════════════════════════════════

@router.post("/reports/rollback")
def preview_rollback_report(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    """Generate structured preview of Rollback Detection Report."""
    return build_rollback_report(payload, current_user)


@router.post("/reports/rollback/pdf")
def download_rollback_report_pdf(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    """Download Rollback Detection Report as PDF."""
    report_data = build_rollback_report(payload, current_user)
    pdf_bytes = generate_rollback_pdf(report_data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Rollback_Report_{report_data["report_id"]}.pdf"'},
    )


@router.post("/reports/resave")
def preview_resave_report(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate structured preview of Re-Save Analysis Report."""
    return build_resave_report(payload, current_user, db)


@router.post("/reports/resave/pdf")
def download_resave_report_pdf(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download Re-Save Analysis Report as PDF."""
    report_data = build_resave_report(payload, current_user, db)
    pdf_bytes = generate_resave_pdf(report_data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ReSave_Report_{report_data["report_id"]}.pdf"'},
    )


@router.post("/reports/keys")
def preview_keys_report(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate structured preview of Signing Key Security Report."""
    return build_keys_report(payload, current_user, db)


@router.post("/reports/keys/pdf")
def download_keys_report_pdf(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download Signing Key Security Report as PDF."""
    report_data = build_keys_report(payload, current_user, db)
    pdf_bytes = generate_keys_pdf(report_data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="SigningKey_Report_{report_data["report_id"]}.pdf"'},
    )
