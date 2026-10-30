"""
ProvenanceGuard SQLAlchemy models.
Additive — does NOT modify existing models.py tables.
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, BigInteger
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class KeyRegistry(Base):
    """
    Signing-key lifecycle registry.
    Public keys stored here; private keys stored ONLY on filesystem.
    """
    __tablename__ = "key_registry"

    id = Column(Integer, primary_key=True, index=True)
    key_id = Column(String(64), unique=True, nullable=False, index=True)
    owner = Column(String(255), nullable=False)
    algorithm = Column(String(50), nullable=False, default="Ed25519")
    public_key_pem = Column(Text, nullable=False)   # public key only
    status = Column(String(30), nullable=False, default="ACTIVE")
    # ACTIVE | ROTATED | REVOKED | COMPROMISED | EXPIRED
    status_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    activated_at = Column(DateTime, nullable=True)
    rotated_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    compromised_at = Column(DateTime, nullable=True)
    compromise_window_start = Column(DateTime, nullable=True)
    compromise_window_end = Column(DateTime, nullable=True)

    signatures = relationship("SignatureRecord", back_populates="key")
    checkpoints = relationship("AuditCheckpoint", back_populates="key")


class SignatureRecord(Base):
    """
    Record of each digital signature operation.
    Links message hashes to key_registry entries.
    """
    __tablename__ = "signature_records"

    id = Column(Integer, primary_key=True, index=True)
    signature_id = Column(String(64), unique=True, nullable=False, index=True)
    key_id = Column(String(64), ForeignKey("key_registry.key_id"), nullable=False)
    message_hash = Column(String(64), nullable=False)   # SHA-256 of the signed message
    signature_b64 = Column(Text, nullable=False)         # Base64-encoded Ed25519 signature
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(Integer, nullable=True)
    actor = Column(String(255), nullable=True)
    signed_at = Column(DateTime, server_default=func.now())
    verification_status = Column(String(50), nullable=True)

    key = relationship("KeyRegistry", back_populates="signatures")


class AuditCheckpoint(Base):
    """
    Trusted audit-chain checkpoint.
    Stored in MySQL AND in filesystem witness for anti-rollback.
    """
    __tablename__ = "audit_checkpoints"

    id = Column(Integer, primary_key=True, index=True)
    checkpoint_id = Column(String(64), unique=True, nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False)       # max audit_logs.id at checkpoint time
    chain_head_hash = Column(String(64), nullable=False)    # current_hash of that log
    chain_entry_count = Column(Integer, nullable=False)     # total audit_logs count
    signed_payload = Column(Text, nullable=False)           # base64 Ed25519 signature
    signing_payload_json = Column(Text, nullable=True)      # the JSON that was signed
    public_key_id = Column(String(64), ForeignKey("key_registry.key_id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    key = relationship("KeyRegistry", back_populates="checkpoints")


class ProvenanceDerivative(Base):
    """
    Records authorized derivative relationships between files.
    e.g. a resaved, resized, or reformatted version of an original registered file.
    """
    __tablename__ = "provenance_derivatives"

    id = Column(Integer, primary_key=True, index=True)
    original_file_id = Column(Integer, ForeignKey("uploaded_files.id"), nullable=False)
    derivative_file_id = Column(Integer, ForeignKey("uploaded_files.id"), nullable=True)
    relationship_type = Column(String(50), nullable=False)
    # RESAVE | RESIZE | RECOMPRESS | FORMAT_CONVERT | UNKNOWN
    similarity_percentage = Column(Float, nullable=True)
    comparison_method = Column(String(100), nullable=True)
    classification = Column(String(50), nullable=True)
    # EXACT_MATCH | CONTENT_SIMILAR | POSSIBLE_DERIVATIVE | CONTENT_MODIFIED | UNABLE_TO_DETERMINE
    authorized_by = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    original_file = relationship("UploadedFile", foreign_keys=[original_file_id])
    derivative_file = relationship("UploadedFile", foreign_keys=[derivative_file_id])

