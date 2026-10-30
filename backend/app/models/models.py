from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, BigInteger
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, default="Demo User")
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(50), default="user")
    created_at = Column(DateTime, server_default=func.now())

    uploaded_files = relationship("UploadedFile", back_populates="user")
    privacy_credentials = relationship("PrivacyCredential", back_populates="user")
    security_tests = relationship("SecurityTest", back_populates="user")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(100))
    file_size = Column(BigInteger)
    storage_path = Column(String(500))
    original_hash = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="uploaded_files")
    verifications = relationship("FileVerification", back_populates="file")


class FileVerification(Base):
    __tablename__ = "file_verifications"
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("uploaded_files.id"), nullable=True)
    submitted_hash = Column(String(64), nullable=False)
    verification_status = Column(String(20), nullable=False)  # MATCH / MISMATCH
    verification_message = Column(Text)
    verified_at = Column(DateTime, server_default=func.now())

    file = relationship("UploadedFile", back_populates="verifications")


class PrivacyCredential(Base):
    __tablename__ = "privacy_credentials"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    credential_type = Column(String(100), nullable=False)
    issuer = Column(String(255))
    verification_status = Column(String(30), nullable=False)  # ELIGIBLE / NOT_ELIGIBLE
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="privacy_credentials")


class SecurityTest(Base):
    __tablename__ = "security_tests"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    input_prompt = Column(Text, nullable=False)
    detected_attack_type = Column(String(100))
    risk_level = Column(String(20), nullable=False)  # LOW/MEDIUM/HIGH/CRITICAL
    risk_score = Column(Float, default=0.0)
    analysis = Column(Text)
    recommendation = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="security_tests")


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"
    id = Column(Integer, primary_key=True, index=True)
    evidence_name = Column(String(255), nullable=False)
    evidence_type = Column(String(100))
    evidence_hash = Column(String(64), nullable=False)
    uploaded_by = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100))
    entity_id = Column(Integer)
    actor = Column(String(255))
    previous_hash = Column(String(64), nullable=True)
    current_hash = Column(String(64), nullable=False)
    timestamp = Column(DateTime, server_default=func.now())


class TrustReport(Base):
    __tablename__ = "trust_reports"
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(64), unique=True, nullable=False)
    integrity_score = Column(Float, default=0.0)
    privacy_status = Column(String(50))
    security_score = Column(Float, default=0.0)
    overall_status = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())

