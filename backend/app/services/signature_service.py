"""
Signature Service for ProvenanceGuard.

Handles signing and structured verification of Ed25519 signatures,
including key lifecycle status awareness.
"""

import uuid
import hashlib
import base64
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.models.provenance_models import SignatureRecord, KeyRegistry
from app.services.key_management_service import (
    sign_message as _sign_raw,
    verify_signature_raw,
    get_key_by_id,
    get_active_key,
)

logger = logging.getLogger(__name__)


# Verification result constants
VR_VALID = "VALID"
VR_INVALID_SIGNATURE = "INVALID_SIGNATURE"
VR_SIGNED_AFTER_REVOCATION = "SIGNED_AFTER_REVOCATION"
VR_POSSIBLY_COMPROMISED = "POSSIBLY_COMPROMISED"
VR_KEY_NOT_FOUND = "KEY_NOT_FOUND"
VR_HISTORICAL_UNKNOWN = "HISTORICAL_UNKNOWN"


def sign_data(
    data: bytes,
    entity_type: Optional[str],
    entity_id: Optional[int],
    actor: str,
    db: Session,
    key_id: Optional[str] = None,
) -> SignatureRecord:
    """
    Sign arbitrary data with the active (or specified) key.
    Stores a SignatureRecord in the DB.
    Returns the SignatureRecord.
    """
    if key_id:
        key_rec = get_key_by_id(key_id, db)
        if not key_rec:
            raise ValueError(f"Key {key_id} not found")
    else:
        key_rec = get_active_key(db)
        if not key_rec:
            raise RuntimeError("No ACTIVE signing key found. Generate a key first.")

    message_hash = hashlib.sha256(data).hexdigest()
    signature_b64 = _sign_raw(data, key_rec.key_id, db)

    sig_record = SignatureRecord(
        signature_id=f"SIG-{uuid.uuid4().hex[:16].upper()}",
        key_id=key_rec.key_id,
        message_hash=message_hash,
        signature_b64=signature_b64,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=actor,
        verification_status=VR_VALID,
    )
    db.add(sig_record)
    db.commit()
    db.refresh(sig_record)
    return sig_record


def verify_signature(
    signature_id: str,
    data: Optional[bytes],
    db: Session,
) -> dict:
    """
    Verify a stored signature, taking key lifecycle status into account.

    Result structure:
    {
      "verification_result": str,    # one of VR_* constants
      "signature_id": str,
      "key_id": str,
      "key_status": str,
      "signed_at": str,
      "message_hash": str,
      "cryptographic_valid": bool,
      "explanation": str,
    }
    """
    sig = db.query(SignatureRecord).filter(
        SignatureRecord.signature_id == signature_id
    ).first()

    if not sig:
        return _result(VR_HISTORICAL_UNKNOWN, None, signature_id, False,
                       "Signature record not found in database.")

    key = get_key_by_id(sig.key_id, db)
    if not key:
        return _result(VR_KEY_NOT_FOUND, sig, signature_id, False,
                       f"Signing key {sig.key_id} not found in key registry.")

    # Step 1: Cryptographic verification
    if data is not None:
        crypto_valid = verify_signature_raw(data, sig.signature_b64, key.public_key_pem)
    else:
        # If original data not provided, skip crypto check — report HISTORICAL_UNKNOWN
        return _result(VR_HISTORICAL_UNKNOWN, sig, signature_id, False,
                       "Original data not provided; cryptographic verification skipped.")

    if not crypto_valid:
        return _result(VR_INVALID_SIGNATURE, sig, signature_id, False,
                       "Cryptographic signature verification FAILED. Signature does not match data.",
                       key)

    # Step 2: Key lifecycle awareness
    signed_at = sig.signed_at
    if signed_at and signed_at.tzinfo is None:
        signed_at = signed_at.replace(tzinfo=timezone.utc)

    # Check if signed AFTER revocation/compromise
    revoked_at = key.revoked_at
    if revoked_at and revoked_at.tzinfo is None:
        revoked_at = revoked_at.replace(tzinfo=timezone.utc)

    if revoked_at and signed_at and signed_at > revoked_at:
        return _result(VR_SIGNED_AFTER_REVOCATION, sig, signature_id, True,
                       f"Signature is cryptographically valid BUT was signed AFTER the key was "
                       f"revoked/compromised at {revoked_at.isoformat()}. This signature is suspect.",
                       key)

    # Check compromise window
    if key.status == "COMPROMISED":
        win_start = key.compromise_window_start
        win_end = key.compromise_window_end
        if win_start and win_start.tzinfo is None:
            win_start = win_start.replace(tzinfo=timezone.utc)
        if win_end and win_end.tzinfo is None:
            win_end = win_end.replace(tzinfo=timezone.utc)

        if win_start and win_end and signed_at:
            if win_start <= signed_at <= win_end:
                return _result(VR_POSSIBLY_COMPROMISED, sig, signature_id, True,
                               f"Signature is cryptographically valid BUT was signed during the "
                               f"reported compromise window ({win_start.isoformat()} to "
                               f"{win_end.isoformat()}). Cannot confirm authenticity.",
                               key)

    # All checks passed
    return _result(VR_VALID, sig, signature_id, True,
                   "Signature is cryptographically valid. Key was ACTIVE at signing time "
                   f"(current status: {key.status}).",
                   key)


def _result(
    result_code: str,
    sig: Optional[SignatureRecord],
    signature_id: str,
    crypto_valid: bool,
    explanation: str,
    key: Optional[KeyRegistry] = None,
) -> dict:
    return {
        "verification_result": result_code,
        "signature_id": signature_id,
        "key_id": sig.key_id if sig else None,
        "key_status": key.status if key else "UNKNOWN",
        "key_owner": key.owner if key else None,
        "signed_at": sig.signed_at.isoformat() if sig and sig.signed_at else None,
        "message_hash": sig.message_hash if sig else None,
        "entity_type": sig.entity_type if sig else None,
        "entity_id": sig.entity_id if sig else None,
        "cryptographic_valid": crypto_valid,
        "explanation": explanation,
    }

