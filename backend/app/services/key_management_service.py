"""
Key Management Service for ProvenanceGuard.

Key design decisions:
- Ed25519 via cryptography library (compact, fast, secure)
- Private keys stored ONLY on filesystem in backend/keys/private/
- Public keys stored in MySQL key_registry table
- Private keys are NEVER stored in DB, NEVER sent to frontend, NEVER in API responses
- Production limitation: for real deployment, use HSM or secrets manager (documented)
"""

import os
import uuid
import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey, Ed25519PublicKey
)
from cryptography.hazmat.primitives import serialization
from sqlalchemy.orm import Session

from app.models.provenance_models import KeyRegistry

logger = logging.getLogger(__name__)

# Filesystem location for private keys
_KEYS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "keys", "private")
os.makedirs(_KEYS_DIR, exist_ok=True)

# Write a .gitignore to prevent accidental key commits
_gitignore_path = os.path.join(os.path.dirname(_KEYS_DIR), ".gitignore")
if not os.path.exists(_gitignore_path):
    with open(_gitignore_path, "w") as f:
        f.write("private/\n*.pem\n")


def _private_key_path(key_id: str) -> str:
    """Return filesystem path for a private key PEM file."""
    # Sanitize key_id to prevent path traversal
    safe_id = key_id.replace("/", "_").replace("..", "_")
    return os.path.join(_KEYS_DIR, f"{safe_id}.pem")


def generate_key_pair(owner: str, db: Session) -> KeyRegistry:
    """
    Generate a new Ed25519 key pair.
    Stores private key on filesystem, public key in DB.
    Returns the KeyRegistry record.
    """
    key_id = f"KEY-{uuid.uuid4().hex[:16].upper()}"
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    # Serialize private key to PEM (no encryption for demo; production: use password/HSM)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    # Serialize public key to PEM
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    # Write private key to filesystem ONLY
    private_path = _private_key_path(key_id)
    with open(private_path, "wb") as f:
        f.write(private_pem)
    # Restrict permissions on non-Windows (best effort)
    try:
        os.chmod(private_path, 0o600)
    except Exception:
        pass

    now = datetime.now(timezone.utc)
    record = KeyRegistry(
        key_id=key_id,
        owner=owner,
        algorithm="Ed25519",
        public_key_pem=public_pem.decode("utf-8"),
        status="ACTIVE",
        created_at=now,
        activated_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info(f"Generated key pair: {key_id} for owner={owner}")
    return record


def get_active_key(db: Session) -> Optional[KeyRegistry]:
    """Return the most recently created ACTIVE key."""
    return (
        db.query(KeyRegistry)
        .filter(KeyRegistry.status == "ACTIVE")
        .order_by(KeyRegistry.id.desc())
        .first()
    )


def get_key_by_id(key_id: str, db: Session) -> Optional[KeyRegistry]:
    return db.query(KeyRegistry).filter(KeyRegistry.key_id == key_id).first()


def _load_private_key(key_id: str) -> Optional[Ed25519PrivateKey]:
    """Load private key from filesystem by key_id."""
    path = _private_key_path(key_id)
    if not os.path.exists(path):
        logger.error(f"Private key file not found for key_id={key_id}")
        return None
    try:
        with open(path, "rb") as f:
            return serialization.load_pem_private_key(f.read(), password=None)
    except Exception as e:
        logger.error(f"Failed to load private key {key_id}: {e}")
        return None


def _load_public_key_from_pem(pem: str) -> Optional[Ed25519PublicKey]:
    """Load public key from PEM string (from DB)."""
    try:
        return serialization.load_pem_public_key(pem.encode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to parse public key PEM: {e}")
        return None


def sign_message(message: bytes, key_id: str, db: Session) -> Optional[str]:
    """
    Sign a message with the private key identified by key_id.
    Returns base64-encoded signature, or None on failure.
    Refuses to sign if key is not ACTIVE.
    """
    key_record = get_key_by_id(key_id, db)
    if not key_record:
        raise ValueError(f"Key {key_id} not found")
    if key_record.status != "ACTIVE":
        raise ValueError(f"Key {key_id} is {key_record.status} — cannot sign with non-ACTIVE keys")

    private_key = _load_private_key(key_id)
    if private_key is None:
        raise RuntimeError(f"Private key for {key_id} not available on filesystem")

    signature = private_key.sign(message)
    return base64.b64encode(signature).decode("utf-8")


def verify_signature_raw(
    message: bytes,
    signature_b64: str,
    public_key_pem: str,
) -> bool:
    """
    Cryptographically verify an Ed25519 signature.
    Returns True if valid, False if invalid.
    """
    pub_key = _load_public_key_from_pem(public_key_pem)
    if pub_key is None:
        return False
    try:
        sig_bytes = base64.b64decode(signature_b64)
        pub_key.verify(sig_bytes, message)
        return True
    except Exception:
        return False


def rotate_key(current_key_id: str, owner: str, db: Session) -> Tuple[KeyRegistry, KeyRegistry]:
    """
    Rotate the key: mark current as ROTATED, generate new ACTIVE key.
    Returns (old_key, new_key).
    """
    old_key = get_key_by_id(current_key_id, db)
    if not old_key:
        raise ValueError(f"Key {current_key_id} not found")
    if old_key.status != "ACTIVE":
        raise ValueError(f"Key {current_key_id} is {old_key.status} — only ACTIVE keys can be rotated")

    old_key.status = "ROTATED"
    old_key.rotated_at = datetime.now(timezone.utc)
    db.commit()

    new_key = generate_key_pair(owner, db)
    logger.info(f"Key rotated: {current_key_id} → {new_key.key_id}")
    return old_key, new_key


def revoke_key(key_id: str, reason: str, db: Session) -> KeyRegistry:
    """Mark a key as REVOKED. Prevents future signing."""
    key = get_key_by_id(key_id, db)
    if not key:
        raise ValueError(f"Key {key_id} not found")
    if key.status in ("REVOKED", "COMPROMISED"):
        raise ValueError(f"Key {key_id} is already {key.status}")

    key.status = "REVOKED"
    key.status_reason = reason
    key.revoked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(key)
    logger.info(f"Key revoked: {key_id}, reason={reason}")
    return key


def report_compromise(
    key_id: str,
    reason: str,
    window_start: Optional[datetime],
    window_end: Optional[datetime],
    db: Session,
) -> KeyRegistry:
    """
    Mark key as COMPROMISED and record the estimated compromise window.
    Signatures created during this window will be flagged POSSIBLY_COMPROMISED.
    """
    key = get_key_by_id(key_id, db)
    if not key:
        raise ValueError(f"Key {key_id} not found")

    now = datetime.now(timezone.utc)
    key.status = "COMPROMISED"
    key.status_reason = reason
    key.compromised_at = now
    key.revoked_at = key.revoked_at or now   # also counts as revoked
    key.compromise_window_start = window_start
    key.compromise_window_end = window_end or now
    db.commit()
    db.refresh(key)
    logger.info(f"Key {key_id} reported compromised. Window: {window_start} to {window_end}")
    return key

