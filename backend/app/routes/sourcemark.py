import os
import io
import json
import shutil
import logging
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import UploadedFile, FileVerification, FileComparison, User
from app.services.auth_service import get_current_user
from app.services.hashing_service import sha256_bytes
from app.services.audit_service import create_audit_event
from app.services.websocket_manager import ws_manager
from app.services.comparison.comparison_service import perform_file_comparison
from app.services.comparison.report_generator import generate_sourcemark_pdf_report
from app.core.config import settings
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sourcemark", tags=["sourcemark"])

BLOCKED_EXTENSIONS = {".exe", ".bat", ".cmd", ".sh", ".msi", ".dll", ".com", ".scr", ".vbs"}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
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

    # Check for duplicates by hash strictly within current user's vault
    existing = db.query(UploadedFile).filter(
        UploadedFile.user_id == current_user.id,
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
        user_id=current_user.id,
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
        create_audit_event(db, "FILE_REGISTERED", "uploaded_file", record.id, current_user.email)
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
    original_file_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file or not file.filename:
        raise HTTPException(400, "No file provided or filename is missing.")

    await file.seek(0)
    content = await file.read()
    submitted_hash = sha256_bytes(content)

    matched_file = None

    # Priority 1: User explicitly specified an original file to compare against (must belong to user)
    if original_file_id:
        matched_file = db.query(UploadedFile).filter(
            UploadedFile.id == original_file_id,
            UploadedFile.user_id == current_user.id
        ).first()
        if not matched_file:
            raise HTTPException(404, f"Registered file ID {original_file_id} not found in your account.")

    # Priority 2: Exact match by hash across current user's registered files
    if not matched_file:
        matched_file = db.query(UploadedFile).filter(
            UploadedFile.user_id == current_user.id,
            func.lower(func.trim(UploadedFile.original_hash)) == submitted_hash
        ).first()

    # Priority 3: Check if a registered file exists with same filename in current user's vault
    if not matched_file:
        matched_file = db.query(UploadedFile).filter(
            UploadedFile.user_id == current_user.id,
            UploadedFile.filename == file.filename
        ).order_by(UploadedFile.id.desc()).first()

    if matched_file:
        registered_hash = matched_file.original_hash.strip().lower()
        is_match = (registered_hash == submitted_hash)
        matched_file_id = matched_file.id

        if is_match:
            status = "MATCH"
            message = f"Integrity verified. File matches registered record '{matched_file.filename}'."
        else:
            status = "MISMATCH"
            message = f"File modification detected. Submitted file '{file.filename}' does not match registered fingerprint."

        # Read original bytes from storage path for detailed comparison
        orig_bytes = b""
        if matched_file.storage_path and os.path.exists(matched_file.storage_path):
            try:
                with open(matched_file.storage_path, "rb") as f:
                    orig_bytes = f.read()
            except Exception as e:
                logger.error(f"Failed to read original file from disk: {e}")

        comp_data = perform_file_comparison(
            orig_bytes=orig_bytes,
            up_bytes=content,
            orig_name=matched_file.filename,
            up_name=file.filename,
            orig_hash=registered_hash,
            up_hash=submitted_hash,
            is_hash_match=is_match,
        )
    else:
        status = "MISMATCH"
        message = "No matching fingerprint or registered file found. File may be modified or unregistered."
        matched_file_id = None
        registered_hash = None
        comp_data = None

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

    # Store FileComparison record if comparison was performed
    if comp_data:
        try:
            file_comp = FileComparison(
                comparison_id=comp_data["comparison_id"],
                original_file_id=matched_file_id,
                original_hash=registered_hash or "",
                uploaded_hash=submitted_hash,
                hash_match_status=status,
                file_type=comp_data.get("file_type", "unknown"),
                comparison_method=comp_data.get("comparison_method", "Standard Hash Comparison"),
                change_percentage=comp_data.get("change_percentage", 0.0),
                similarity_percentage=comp_data.get("similarity_percentage", 100.0),
                comparison_details=json.dumps(comp_data),
            )
            db.add(file_comp)
            db.commit()
            db.refresh(file_comp)

            # Audit event for file comparison
            create_audit_event(
                db,
                "FILE_COMPARISON_PERFORMED",
                "file_comparison",
                file_comp.id,
                current_user.email
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save file comparison record: {e}")

    try:
        create_audit_event(
            db, f"FILE_{status}", "file_verification", verification.id,
            current_user.email
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
        "comparison": comp_data,
    }


@router.get("/report/{comparison_id}/download")
def download_comparison_report(
    comparison_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comp = db.query(FileComparison).filter(FileComparison.comparison_id == comparison_id).first()
    if not comp:
        raise HTTPException(404, f"Comparison report '{comparison_id}' not found.")
    if comp.original_file and comp.original_file.user_id != current_user.id:
        raise HTTPException(404, f"Comparison report '{comparison_id}' not found.")

    if comp.comparison_details:
        try:
            comp_data = json.loads(comp.comparison_details)
        except Exception:
            comp_data = {
                "comparison_id": comp.comparison_id,
                "verification_status": comp.hash_match_status,
                "change_percentage": comp.change_percentage,
                "similarity_percentage": comp.similarity_percentage,
                "summary": f"Report for comparison {comp.comparison_id}",
            }
    else:
        comp_data = {
            "comparison_id": comp.comparison_id,
            "verification_status": comp.hash_match_status,
            "change_percentage": comp.change_percentage,
            "similarity_percentage": comp.similarity_percentage,
            "summary": f"Report for comparison {comp.comparison_id}",
        }

    try:
        pdf_bytes = generate_sourcemark_pdf_report(comp_data)
    except Exception as e:
        logger.error(f"PDF report generation error: {e}")
        raise HTTPException(500, f"Failed to generate PDF report: {str(e)}")

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="SourceMark_Report_{comparison_id}.pdf"'
        }
    )


@router.get("/files")
def list_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        files = (
            db.query(UploadedFile)
            .filter(UploadedFile.user_id == current_user.id)
            .order_by(UploadedFile.id.desc())
            .all()
        )
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
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verifications = (
        db.query(FileVerification, UploadedFile)
        .join(UploadedFile, FileVerification.file_id == UploadedFile.id)
        .filter(UploadedFile.user_id == current_user.id)
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

