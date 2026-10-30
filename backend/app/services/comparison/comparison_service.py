import os
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.services.comparison.text_comparison import compare_text
from app.services.comparison.pdf_comparison import compare_pdf
from app.services.comparison.docx_comparison import compare_docx
from app.services.comparison.pptx_comparison import compare_pptx
from app.services.comparison.image_comparison import compare_image
from app.services.comparison.archive_comparison import compare_zip
from app.services.comparison.binary_comparison import compare_binary

def detect_file_format(filename: str, data: bytes) -> str:
    """Detect file category using filename extension and magic bytes."""
    ext = os.path.splitext(filename)[1].lower()

    if ext in (".txt", ".csv", ".json", ".xml", ".html", ".htm", ".md", ".py", ".js", ".css", ".sql", ".log"):
        return "txt"
    if ext == ".pdf" or data.startswith(b"%PDF"):
        return "pdf"
    if ext in (".docx", ".dotx") or (data.startswith(b"PK\x03\x04") and b"word/" in data[:4096]):
        return "docx"
    if ext in (".pptx", ".potx", ".ppsx") or (data.startswith(b"PK\x03\x04") and b"ppt/" in data[:4096]):
        return "pptx"
    if ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif") or data.startswith(b"\x89PNG") or data.startswith(b"\xff\xd8"):
        return "image"
    if ext in (".zip",) or (data.startswith(b"PK\x03\x04") and not (b"word/" in data[:4096] or b"ppt/" in data[:4096])):
        return "zip"

    return "binary"


def perform_file_comparison(
    orig_bytes: bytes,
    up_bytes: bytes,
    orig_name: str,
    up_name: str,
    orig_hash: str,
    up_hash: str,
    is_hash_match: bool,
) -> Dict[str, Any]:
    """
    Master comparison dispatcher for SourceMark 2.0.
    Calculates change percentage, similarity percentage, and structured difference analysis.
    """
    comparison_id = f"CMP-{uuid.uuid4().hex[:12].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    file_category = detect_file_format(up_name, up_bytes)
    orig_size = len(orig_bytes)
    up_size = len(up_bytes)

    # 1. Exact SHA-256 Match: Authoritative Verification
    if is_hash_match:
        return {
            "comparison_id": comparison_id,
            "verification_status": "MATCH",
            "hash_match_status": "MATCH",
            "file_type": file_category,
            "comparison_method": "SHA-256 Exact Cryptographic Fingerprint Match",
            "change_percentage": 0.0,
            "similarity_percentage": 100.0,
            "summary": "Cryptographic integrity verified. The uploaded file is bit-for-bit identical to the registered original (0.0% difference).",
            "added": [],
            "removed": [],
            "modified": [],
            "affected_pages": [],
            "structural_details": {
                "byte_match": True,
                "size_match": True,
            },
            "original_integrity": {
                "filename": orig_name,
                "hash": orig_hash,
                "size": orig_size,
            },
            "uploaded_integrity": {
                "filename": up_name,
                "hash": up_hash,
                "size": up_size,
            },
            "timestamp": now_iso,
        }

    # 2. Hash Mismatch: Perform deep format-specific comparison
    try:
        if file_category == "pdf":
            diff_result = compare_pdf(orig_bytes, up_bytes, orig_name, up_name)
        elif file_category == "docx":
            diff_result = compare_docx(orig_bytes, up_bytes, orig_name, up_name)
        elif file_category == "pptx":
            diff_result = compare_pptx(orig_bytes, up_bytes, orig_name, up_name)
        elif file_category == "txt":
            diff_result = compare_text(orig_bytes, up_bytes, orig_name, up_name)
        elif file_category == "image":
            diff_result = compare_image(orig_bytes, up_bytes, orig_name, up_name)
        elif file_category == "zip":
            diff_result = compare_zip(orig_bytes, up_bytes, orig_name, up_name)
        else:
            diff_result = compare_binary(orig_bytes, up_bytes, orig_name, up_name)
    except Exception as e:
        # Fallback to binary comparison on unexpected engine failure
        diff_result = compare_binary(orig_bytes, up_bytes, orig_name, up_name)
        diff_result["summary"] += f" (Note: Format-specific parser encountered: {str(e)}; fell back to binary comparison)."

    # Enforce rule: If SHA-256 differed, change_percentage can never be 0.0%
    change_pct = max(0.01, diff_result.get("change_percentage", 0.0))
    sim_pct = min(99.99, diff_result.get("similarity_percentage", 100.0))

    return {
        "comparison_id": comparison_id,
        "verification_status": "MISMATCH",
        "hash_match_status": "MISMATCH",
        "file_type": diff_result.get("file_type", file_category),
        "comparison_method": diff_result.get("comparison_method", "Format-Specific Analysis"),
        "change_percentage": change_pct,
        "similarity_percentage": sim_pct,
        "summary": diff_result.get("summary", "File modification detected between registered and uploaded versions."),
        "added": diff_result.get("added", []),
        "removed": diff_result.get("removed", []),
        "modified": diff_result.get("modified", []),
        "affected_pages": diff_result.get("affected_pages", []),
        "structural_details": diff_result.get("structural_details", {}),
        "original_integrity": {
            "filename": orig_name,
            "hash": orig_hash,
            "size": orig_size,
        },
        "uploaded_integrity": {
            "filename": up_name,
            "hash": up_hash,
            "size": up_size,
        },
        "timestamp": now_iso,
    }

