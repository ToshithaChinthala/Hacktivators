import io
import difflib
from typing import Dict, Any, List
import pypdf

def extract_pdf_pages(data: bytes) -> List[str]:
    """Extract text page-by-page from PDF bytes."""
    pages_text: List[str] = []
    reader = pypdf.PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            raise ValueError("PDF is encrypted and requires a password to inspect.")

    for page in reader.pages:
        try:
            txt = page.extract_text() or ""
            pages_text.append(txt)
        except Exception:
            pages_text.append("")
    return pages_text


def compare_pdf(orig_bytes: bytes, up_bytes: bytes, orig_name: str, up_name: str) -> Dict[str, Any]:
    """
    Compare original and uploaded PDF documents.
    Extracts text page-by-page, identifies affected pages, added/removed/modified text.
    """
    try:
        orig_pages = extract_pdf_pages(orig_bytes)
    except Exception as e:
        return {
            "file_type": "pdf",
            "comparison_method": "PDF Text Extraction (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not extract original PDF text: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "structural_details": {"error": str(e)},
        }

    try:
        up_pages = extract_pdf_pages(up_bytes)
    except Exception as e:
        return {
            "file_type": "pdf",
            "comparison_method": "PDF Text Extraction (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not extract uploaded PDF text: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "structural_details": {"error": str(e)},
        }

    orig_full_text = "\n\n".join(orig_pages).strip()
    up_full_text = "\n\n".join(up_pages).strip()

    # If neither PDF has extractable text (e.g. scanned pure images), fallback to stream comparison
    if not orig_full_text and not up_full_text:
        byte_matcher = difflib.SequenceMatcher(None, orig_bytes[:100000], up_bytes[:100000])
        sim_pct = round(byte_matcher.ratio() * 100.0, 2)
        chg_pct = round(max(0.0, 100.0 - sim_pct), 2)
        return {
            "file_type": "pdf",
            "comparison_method": "PDF Binary Stream Analysis (Scanned / Image-Only)",
            "change_percentage": chg_pct,
            "similarity_percentage": sim_pct,
            "summary": "PDF has no extractable text layer (scanned or raster image PDF). Analyzed via stream data comparison.",
            "added": [],
            "removed": [],
            "modified": [],
            "affected_pages": [],
            "structural_details": {
                "original_pages": len(orig_pages),
                "uploaded_pages": len(up_pages),
                "page_count_delta": len(up_pages) - len(orig_pages),
                "raster_only": True,
            },
        }

    # Sequence similarity on extracted text
    matcher = difflib.SequenceMatcher(None, orig_full_text, up_full_text)
    sim_ratio = matcher.ratio()
    similarity_pct = round(sim_ratio * 100.0, 2)
    change_pct = round(max(0.0, 100.0 - similarity_pct), 2)

    # Page-by-page comparison to identify affected pages
    affected_pages: List[int] = []
    added_sections: List[str] = []
    removed_sections: List[str] = []
    modified_sections: List[Dict[str, Any]] = []

    max_pages = max(len(orig_pages), len(up_pages))
    for p_idx in range(max_pages):
        p_num = p_idx + 1
        p_orig = orig_pages[p_idx] if p_idx < len(orig_pages) else ""
        p_up = up_pages[p_idx] if p_idx < len(up_pages) else ""

        if p_orig != p_up:
            affected_pages.append(p_num)
            p_matcher = difflib.SequenceMatcher(None, p_orig.splitlines(), p_up.splitlines())
            for tag, i1, i2, j1, j2 in p_matcher.get_opcodes():
                if tag == "replace":
                    if len(modified_sections) < 15:
                        modified_sections.append({
                            "page": p_num,
                            "original": "\n".join(p_orig.splitlines()[i1:i2])[:350],
                            "modified": "\n".join(p_up.splitlines()[j1:j2])[:350],
                        })
                elif tag == "delete":
                    del_text = "\n".join(p_orig.splitlines()[i1:i2]).strip()
                    if del_text and len(removed_sections) < 15:
                        removed_sections.append(f"[Page {p_num}] {del_text[:250]}")
                elif tag == "insert":
                    ins_text = "\n".join(p_up.splitlines()[j1:j2]).strip()
                    if ins_text and len(added_sections) < 15:
                        added_sections.append(f"[Page {p_num}] {ins_text[:250]}")

    page_summary = f"{len(affected_pages)} page(s) affected ({', '.join(f'p.{p}' for p in affected_pages[:6])})" if affected_pages else "No page content changes"
    summary = (
        f"PDF Content Analysis: {page_summary}. "
        f"Calculated text similarity is {similarity_pct}% with {change_pct}% modification."
    )

    return {
        "file_type": "pdf",
        "comparison_method": "PDF Page-by-Page Content & Structure Analysis",
        "change_percentage": change_pct,
        "similarity_percentage": similarity_pct,
        "summary": summary,
        "affected_pages": affected_pages,
        "added": added_sections,
        "removed": removed_sections,
        "modified": modified_sections,
        "structural_details": {
            "original_pages": len(orig_pages),
            "uploaded_pages": len(up_pages),
            "page_count_delta": len(up_pages) - len(orig_pages),
            "total_affected_pages": len(affected_pages),
        },
    }

