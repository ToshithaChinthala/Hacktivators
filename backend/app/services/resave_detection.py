"""
Re-Save / Derivative Detection Service for ProvenanceGuard Feature B.

Sits on top of the existing SourceMark 2.0 comparison engine.
Adds:
  - Perceptual hashing (imagehash) for image resave/resize/recompress detection
  - Result classification layer: EXACT_MATCH / CONTENT_SIMILAR / POSSIBLE_DERIVATIVE
    / CONTENT_MODIFIED / UNABLE_TO_DETERMINE
  - Does NOT duplicate existing SHA-256 or format comparison logic
"""

import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Classification thresholds
PHASH_DERIVATIVE_THRESHOLD = 12  # pHash distance ≤ 12 → likely derivative
SIMILARITY_EXACT = 100.0
SIMILARITY_SIMILAR = 95.0
SIMILARITY_DERIVATIVE = 70.0

# Result constants
CLS_EXACT_MATCH = "EXACT_MATCH"
CLS_CONTENT_SIMILAR = "CONTENT_SIMILAR"
CLS_POSSIBLE_DERIVATIVE = "POSSIBLE_DERIVATIVE"
CLS_CONTENT_MODIFIED = "CONTENT_MODIFIED"
CLS_UNABLE_TO_DETERMINE = "UNABLE_TO_DETERMINE"


def compute_perceptual_hash(image_bytes: bytes) -> Optional[str]:
    """
    Compute a perceptual hash (pHash) of an image.
    Returns hex string or None on failure.
    """
    try:
        import imagehash
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        phash = imagehash.phash(img)
        return str(phash)
    except Exception as e:
        logger.warning(f"Perceptual hash computation failed: {e}")
        return None


def perceptual_hash_distance(hash1: str, hash2: str) -> Optional[int]:
    """Return Hamming distance between two perceptual hash strings."""
    try:
        import imagehash
        h1 = imagehash.hex_to_hash(hash1)
        h2 = imagehash.hex_to_hash(hash2)
        return int(h1 - h2)
    except Exception as e:
        logger.warning(f"pHash distance computation failed: {e}")
        return None


def classify_comparison(
    is_exact_hash_match: bool,
    similarity_percentage: float,
    file_type: str,
    orig_bytes: bytes,
    new_bytes: bytes,
) -> dict:
    """
    Classify a file comparison result into a ProvenanceGuard category.

    Returns:
    {
      "classification": str,
      "classification_label": str,
      "classification_explanation": str,
      "perceptual_hash_orig": str|None,
      "perceptual_hash_new": str|None,
      "perceptual_distance": int|None,
    }
    """
    phash_orig = None
    phash_new = None
    phash_dist = None

    # For images, compute perceptual hash for derivative detection
    if file_type == "image":
        phash_orig = compute_perceptual_hash(orig_bytes)
        phash_new = compute_perceptual_hash(new_bytes)
        if phash_orig and phash_new:
            phash_dist = perceptual_hash_distance(phash_orig, phash_new)

    base = {
        "perceptual_hash_orig": phash_orig,
        "perceptual_hash_new": phash_new,
        "perceptual_distance": int(phash_dist) if phash_dist is not None else None,
    }

    # Exact SHA-256 match — authoritative EXACT_MATCH
    if is_exact_hash_match:
        return {
            "classification": CLS_EXACT_MATCH,
            "classification_label": "Exact Match",
            "classification_explanation": (
                "SHA-256 hashes are identical. Files are bit-for-bit equal. "
                "No changes of any kind."
            ),
            **base,
        }

    # Image-specific perceptual match (resave/resize/recompress detection)
    if file_type == "image" and phash_dist is not None:
        if phash_dist <= PHASH_DERIVATIVE_THRESHOLD:
            return {
                "classification": CLS_POSSIBLE_DERIVATIVE,
                "classification_label": "Possible Derivative / Re-Save",
                "classification_explanation": (
                    f"SHA-256 hashes differ (byte-level change detected), but perceptual hash "
                    f"distance is {phash_dist} (≤{PHASH_DERIVATIVE_THRESHOLD}), indicating the "
                    f"images are visually nearly identical. This is consistent with a re-save, "
                    f"recompression, or minor format conversion. "
                    f"IMPORTANT: Similarity alone does not confirm authenticity or authorization."
                ),
                **base,
            }

    # General similarity-based classification
    if similarity_percentage >= SIMILARITY_SIMILAR:
        return {
            "classification": CLS_CONTENT_SIMILAR,
            "classification_label": "Content Similar",
            "classification_explanation": (
                f"SHA-256 hashes differ (byte-level changes present), but content similarity "
                f"is {similarity_percentage:.1f}% (≥{SIMILARITY_SIMILAR}%). "
                f"Minor changes detected. Could be metadata edits, whitespace, or formatting. "
                f"IMPORTANT: Similarity alone does not confirm authenticity or authorization."
            ),
            **base,
        }

    if similarity_percentage >= SIMILARITY_DERIVATIVE:
        return {
            "classification": CLS_POSSIBLE_DERIVATIVE,
            "classification_label": "Possible Derivative",
            "classification_explanation": (
                f"SHA-256 hashes differ. Content similarity is {similarity_percentage:.1f}% "
                f"({SIMILARITY_DERIVATIVE}–{SIMILARITY_SIMILAR}%). "
                f"Substantial shared content detected — may be a derivative version. "
                f"IMPORTANT: Similarity alone does not confirm authenticity or authorization."
            ),
            **base,
        }

    return {
        "classification": CLS_CONTENT_MODIFIED,
        "classification_label": "Content Modified",
        "classification_explanation": (
            f"SHA-256 hashes differ. Content similarity is {similarity_percentage:.1f}% "
            f"(below {SIMILARITY_DERIVATIVE}%). Significant content changes detected."
        ),
        **base,
    }


def analyze_resave(
    orig_bytes: bytes,
    new_bytes: bytes,
    orig_name: str,
    new_name: str,
    orig_hash: str,
    new_hash: str,
) -> dict:
    """
    Full re-save analysis: run format-specific comparison + perceptual classification.
    Returns combined result dict.
    """
    from app.services.comparison.comparison_service import (
        perform_file_comparison,
        detect_file_format,
    )

    is_match = (orig_hash.lower().strip() == new_hash.lower().strip())
    file_type = detect_file_format(new_name, new_bytes)

    # Run existing comparison engine
    try:
        comparison = perform_file_comparison(
            orig_bytes=orig_bytes,
            up_bytes=new_bytes,
            orig_name=orig_name,
            up_name=new_name,
            orig_hash=orig_hash,
            up_hash=new_hash,
            is_hash_match=is_match,
        )
    except Exception as e:
        logger.error(f"Comparison engine error: {e}")
        comparison = {
            "comparison_id": "ERROR",
            "verification_status": "MISMATCH",
            "file_type": file_type,
            "comparison_method": "Error",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Comparison engine error: {e}",
            "added": [], "removed": [], "modified": [], "affected_pages": [],
        }

    # Apply classification layer
    classification_result = classify_comparison(
        is_exact_hash_match=is_match,
        similarity_percentage=comparison.get("similarity_percentage", 0.0),
        file_type=file_type,
        orig_bytes=orig_bytes,
        new_bytes=new_bytes,
    )

    return {
        "comparison": comparison,
        "classification": classification_result["classification"],
        "classification_label": classification_result["classification_label"],
        "classification_explanation": classification_result["classification_explanation"],
        "perceptual_hash_orig": classification_result.get("perceptual_hash_orig"),
        "perceptual_hash_new": classification_result.get("perceptual_hash_new"),
        "perceptual_distance": classification_result.get("perceptual_distance"),
        "is_exact_hash_match": is_match,
        "original_hash": orig_hash,
        "new_hash": new_hash,
        "original_filename": orig_name,
        "new_filename": new_name,
    }

