"""
Checkpoint Service for ProvenanceGuard Feature A — Rollback Protection.

Checkpoints are stored in TWO places:
  1. audit_checkpoints table in MySQL (queryable, but rollback-vulnerable)
  2. backend/checkpoints/witness_store.json (filesystem, independent anti-rollback witness)

Trust model:
  - Protects against: MySQL database rollback to an older snapshot
  - Limitation: Does NOT protect against a total filesystem + DB compromise
  - Production recommendation: replicate witness_store.json to an offline/external
    system (separate cloud bucket, HSM-backed log, or paper backup of checkpoint hashes)

Checkpoint payload that is signed:
  {
    "checkpoint_id": str,
    "sequence_number": int,         # max audit_logs.id at checkpoint time
    "chain_head_hash": str,         # current_hash of that log entry
    "chain_entry_count": int,       # total count of audit_logs
    "created_at": str (ISO-8601),
  }
"""

import os
import json
import uuid
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import AuditLog
from app.models.provenance_models import AuditCheckpoint
from app.services.key_management_service import (
    get_active_key,
    sign_message as _sign_raw,
)

logger = logging.getLogger(__name__)

# Witness file location — OUTSIDE MySQL, on local filesystem
_CHECKPOINTS_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "checkpoints"
)
os.makedirs(_CHECKPOINTS_DIR, exist_ok=True)
_WITNESS_FILE = os.path.join(_CHECKPOINTS_DIR, "witness_store.json")

# Gitignore for checkpoints (don't lose witness data on reset)
_gi = os.path.join(_CHECKPOINTS_DIR, ".gitignore")
if not os.path.exists(_gi):
    with open(_gi, "w") as f:
        f.write("# Keep witness_store.json — it is the anti-rollback anchor\n!witness_store.json\n")


# ─── Witness file I/O ──────────────────────────────────────────────────────────

def _load_witness() -> list:
    """Load the full witness store (list of checkpoint dicts)."""
    if not os.path.exists(_WITNESS_FILE):
        return []
    try:
        with open(_WITNESS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"Failed to load witness store: {e}")
        return []


def _append_witness(checkpoint_dict: dict) -> None:
    """Append a checkpoint record to the witness file (append-only)."""
    store = _load_witness()
    store.append(checkpoint_dict)
    try:
        with open(_WITNESS_FILE, "w", encoding="utf-8") as f:
            json.dump(store, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to write witness store: {e}")
        raise RuntimeError(f"Witness store write failed: {e}")


def get_latest_witness() -> Optional[dict]:
    """Return the most recent checkpoint from the witness file."""
    store = _load_witness()
    return store[-1] if store else None


def get_all_witnesses() -> list:
    return _load_witness()


# ─── Checkpoint Creation ────────────────────────────────────────────────────────

def create_checkpoint(db: Session, actor: str = "system") -> dict:
    """
    Create, sign, and persist a new checkpoint.

    Steps:
    1. Query audit_logs for sequence_number (max id) and chain_head_hash
    2. Build the signed payload JSON
    3. Sign with the active Ed25519 key (if available)
    4. Write to audit_checkpoints table AND witness file
    5. Return summary dict
    """
    # 1. Gather chain state
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).all()
    if not logs:
        return {
            "status": "SKIPPED",
            "message": "No audit log entries to checkpoint.",
            "sequence_number": 0,
        }

    head_log = logs[0]
    sequence_number = head_log.id
    chain_head_hash = head_log.current_hash
    chain_entry_count = len(logs)

    checkpoint_id = f"CKP-{uuid.uuid4().hex[:16].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    payload_dict = {
        "checkpoint_id": checkpoint_id,
        "sequence_number": sequence_number,
        "chain_head_hash": chain_head_hash,
        "chain_entry_count": chain_entry_count,
        "created_at": now_iso,
    }
    payload_json = json.dumps(payload_dict, sort_keys=True)
    payload_bytes = payload_json.encode("utf-8")

    # 2. Sign the payload
    active_key = get_active_key(db)
    signature_b64 = None
    key_id_used = None

    if active_key:
        try:
            signature_b64 = _sign_raw(payload_bytes, active_key.key_id, db)
            key_id_used = active_key.key_id
        except Exception as e:
            logger.warning(f"Checkpoint signing failed: {e}. Checkpoint will be unsigned.")
    else:
        logger.warning("No active signing key found — checkpoint will be unsigned.")

    signed_payload = signature_b64 or "UNSIGNED"

    # 3. Persist to MySQL
    db_record = AuditCheckpoint(
        checkpoint_id=checkpoint_id,
        sequence_number=sequence_number,
        chain_head_hash=chain_head_hash,
        chain_entry_count=chain_entry_count,
        signed_payload=signed_payload,
        signing_payload_json=payload_json,
        public_key_id=key_id_used,
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    # 4. Persist to witness file (independent of MySQL)
    witness_entry = {
        "checkpoint_id": checkpoint_id,
        "sequence_number": sequence_number,
        "chain_head_hash": chain_head_hash,
        "chain_entry_count": chain_entry_count,
        "signed_payload": signed_payload,
        "signing_payload_json": payload_json,
        "public_key_id": key_id_used,
        "created_at": now_iso,
        "db_id": db_record.id,
    }
    _append_witness(witness_entry)

    logger.info(f"Checkpoint created: {checkpoint_id} seq={sequence_number}")
    return {
        "status": "CREATED",
        "checkpoint_id": checkpoint_id,
        "sequence_number": sequence_number,
        "chain_head_hash": chain_head_hash,
        "chain_entry_count": chain_entry_count,
        "signed": signature_b64 is not None,
        "signing_key": key_id_used,
        "created_at": now_iso,
    }


# ─── Rollback Detection ─────────────────────────────────────────────────────────

def verify_rollback(db: Session) -> dict:
    """
    Compare current DB audit chain state against the latest trusted checkpoint witness.

    Detection cases:
    - INTACT: current state >= checkpoint state and hashes match
    - ROLLBACK_DETECTED: current max_id < checkpoint sequence_number
    - TRUNCATION_DETECTED: current count < checkpoint count (gaps or deletions)
    - HASH_MISMATCH: same ID but different head hash (tampering)
    - NO_CHECKPOINT: no checkpoint exists yet
    """
    witness = get_latest_witness()
    if not witness:
        return {
            "status": "NO_CHECKPOINT",
            "rollback_detected": False,
            "message": "No trusted checkpoint found. Create a checkpoint first to enable rollback detection.",
        }

    # Current DB state
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).all()
    current_count = len(logs)
    current_max_id = logs[0].id if logs else 0
    current_head_hash = logs[0].current_hash if logs else None

    cp_seq = witness["sequence_number"]
    cp_count = witness["chain_entry_count"]
    cp_head = witness["chain_head_hash"]
    cp_id = witness["checkpoint_id"]
    cp_time = witness["created_at"]

    detail = {
        "checkpoint_id": cp_id,
        "checkpoint_created_at": cp_time,
        "checkpoint_sequence": cp_seq,
        "checkpoint_count": cp_count,
        "checkpoint_head_hash": cp_head,
        "current_max_id": current_max_id,
        "current_count": current_count,
        "current_head_hash": current_head_hash,
        "witness_signed": witness.get("signed_payload") not in (None, "UNSIGNED"),
    }

    # Detection logic
    if current_max_id < cp_seq:
        return {
            "status": "ROLLBACK_DETECTED",
            "rollback_detected": True,
            "severity": "CRITICAL",
            "message": (
                f"ROLLBACK DETECTED: Current highest audit log ID ({current_max_id}) is less than "
                f"the trusted checkpoint sequence ({cp_seq}). Recent audit records appear to have been deleted."
            ),
            **detail,
        }

    if current_count < cp_count:
        return {
            "status": "TRUNCATION_DETECTED",
            "rollback_detected": True,
            "severity": "HIGH",
            "message": (
                f"HISTORY TRUNCATION: Current entry count ({current_count}) is less than "
                f"the checkpoint count ({cp_count}). Audit records may have been removed."
            ),
            **detail,
        }

    # Check head hash at checkpoint sequence
    log_at_checkpoint = db.query(AuditLog).filter(AuditLog.id == cp_seq).first()
    if log_at_checkpoint:
        actual_hash_at_cp = log_at_checkpoint.current_hash
        if actual_hash_at_cp != cp_head:
            return {
                "status": "HASH_MISMATCH",
                "rollback_detected": True,
                "severity": "CRITICAL",
                "message": (
                    f"TAMPER DETECTED: The hash at audit log #{cp_seq} no longer matches "
                    f"the trusted checkpoint. The chain has been manipulated."
                ),
                "actual_hash_at_checkpoint": actual_hash_at_cp,
                **detail,
            }
    else:
        # The specific log entry referenced by the checkpoint is missing
        return {
            "status": "ROLLBACK_DETECTED",
            "rollback_detected": True,
            "severity": "CRITICAL",
            "message": (
                f"ROLLBACK DETECTED: Audit log entry #{cp_seq} (referenced by checkpoint) no longer exists."
            ),
            **detail,
        }

    return {
        "status": "INTACT",
        "rollback_detected": False,
        "severity": "NONE",
        "message": (
            f"Audit chain integrity confirmed. Current state ({current_count} entries, "
            f"max_id={current_max_id}) is consistent with trusted checkpoint "
            f"(seq={cp_seq}, count={cp_count})."
        ),
        **detail,
    }

