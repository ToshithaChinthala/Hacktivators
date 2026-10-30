import os
import shutil
import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import UploadedFile, FileVerification
from app.services.hashing_service import sha256_bytes
from app.services.audit_service import create_audit_event
from app.services.websocket_manager import ws_manager
from app.core.config import settings
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sourcemark", tags=["sourcemark"])

BLOCKED_EXTENSIONS = {".exe", ".bat", ".cmd", ".sh", ".msi", ".dll", ".com", ".scr", ".vbs"}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: int = Form(default=1),
    db: Session = Depends(get_db),
):
    if not file or not file.filename:
        raise HTTPException(400, "No file provided or filename is missing.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' is not permitted for security reasons.")

    await file.seek(0)
    content = await file.read()
    size = len(content)
    if size == 0:
        raise HTTPException(400, "Uploaded file is empty (0 bytes).")
    if size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB limit.")

    file_hash = sha256_bytes(content)

    # Check for duplicates by hash
    existing = db.query(UploadedFile).filter(
        func.lower(func.trim(UploadedFile.original_hash)) == file_hash
    ).first()
    if existing:
        return {
            "id": existing.id,
            "filename": existing.filename,
            "original_hash": existing.original_hash,
            "file_size": existing.file_size,
            "created_at": existing.created_at.isoformat() if existing.created_at else None,
            "message": f"File with this fingerprint is already registered as '{existing.filename}'.",
            "already_exists": True,
        }

    # Save file to disk
    dest_dir = os.path.join(settings.UPLOAD_DIR, "sourcemark")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{file_hash[:16]}_{file.filename}")
    try:
        with open(dest, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"Failed to write file to disk: {e}")
        raise HTTPException(500, f"Failed to store file on disk: {str(e)}")

    record = UploadedFile(
        user_id=user_id,
        filename=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=size,
        storage_path=dest,
        original_hash=file_hash,
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception as e:
        db.rollback()
        logger.error(f"Database commit error in upload_file: {e}")
        raise HTTPException(500, f"Database commit failed: {str(e)}")

    try:
        create_audit_event(db, "FILE_REGISTERED", "uploaded_file", record.id, f"user_{user_id}")
    except Exception as e:
        logger.error(f"Audit event creation failed: {e}")

    try:
        asyncio.create_task(ws_manager.broadcast({
            "module": "sourcemark",
            "event": "file_registered",
            "file_id": record.id,
            "filename": record.filename,
        }))
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")

    return {
        "id": record.id,
        "filename": record.filename,
        "original_hash": record.original_hash,
        "file_size": record.file_size,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "message": "File registered successfully.",
        "already_exists": False,
    }


@router.post("/verify")
async def verify_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file or not file.filename:
        raise HTTPException(400, "No file provided or filename is missing.")

    await file.seek(0)
    content = await file.read()
    submitted_hash = sha256_bytes(content)

    # 1. Exact match by hash across all registered files
    match = db.query(UploadedFile).filter(
        func.lower(func.trim(UploadedFile.original_hash)) == submitted_hash
    ).first()

    if match:
        status = "MATCH"
        message = f"Integrity verified. File matches registered record '{match.filename}'."
        matched_file_id = match.id
        registered_hash = match.original_hash.strip().lower()
    else:
        # 2. Check if a registered file exists with the same filename (detecting modification)
        match_by_name = db.query(UploadedFile).filter(
            UploadedFile.filename == file.filename
        ).order_by(UploadedFile.id.desc()).first()

        if match_by_name:
            status = "MISMATCH"
            message = f"File modification detected. Submitted file '{file.filename}' does not match registered fingerprint."
            matched_file_id = match_by_name.id
            registered_hash = match_by_name.original_hash.strip().lower()
        else:
            status = "MISMATCH"
            message = "No matching fingerprint or registered file found. File may be modified or unregistered."
            matched_file_id = None
            registered_hash = None

    verification = FileVerification(
        file_id=matched_file_id,
        submitted_hash=submitted_hash,
        verification_status=status,
        verification_message=message,
    )

    try:
        db.add(verification)
        db.commit()
        db.refresh(verification)
    except Exception as e:
        db.rollback()
        logger.error(f"Database commit error in verify_file: {e}")
        raise HTTPException(500, f"Database commit failed: {str(e)}")

    try:
        create_audit_event(
            db, f"FILE_{status}", "file_verification", verification.id,
            "system"
        )
    except Exception as e:
        logger.error(f"Audit event creation failed: {e}")

    try:
        asyncio.create_task(ws_manager.broadcast({
            "module": "sourcemark",
            "event": "file_verified",
            "status": status,
            "verification_id": verification.id,
        }))
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")

    return {
        "verification_status": status,
        "submitted_hash": submitted_hash,
        "original_hash": registered_hash,
        "verification_message": message,
        "verified_at": verification.verified_at.isoformat() if verification.verified_at else None,
    }


@router.get("/files")
def list_files(db: Session = Depends(get_db)):
    try:
        files = db.query(UploadedFile).order_by(UploadedFile.id.desc()).all()
        return [
            {
                "id": f.id,
                "filename": f.filename,
                "file_type": f.file_type,
                "file_size": f.file_size,
                "original_hash": f.original_hash,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in files
        ]
    except Exception as e:
        logger.error(f"Error querying uploaded files: {e}")
        raise HTTPException(500, f"Failed to retrieve files: {str(e)}")


@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    verifications = (
        db.query(FileVerification, UploadedFile)
        .outerjoin(UploadedFile, FileVerification.file_id == UploadedFile.id)
        .order_by(FileVerification.verified_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": v.id,
            "filename": f.filename if f else "Unknown",
            "submitted_hash": v.submitted_hash,
            "verification_status": v.verification_status,
            "verification_message": v.verification_message,
            "verified_at": v.verified_at.isoformat() if v.verified_at else None,
        }
        for v, f in verifications
    ]

