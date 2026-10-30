import io
import difflib
from typing import Dict, Any, List
import docx

def extract_docx_elements(data: bytes) -> Dict[str, Any]:
    """Extract paragraphs and table text from a docx file."""
    doc = docx.Document(io.BytesIO(data))
    paragraphs: List[str] = [p.text for p in doc.paragraphs if p.text.strip()]
    tables_data: List[str] = []
    for t in doc.tables:
        for row in t.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                tables_data.append(row_text)

    full_text = "\n".join(paragraphs + tables_data)
    return {
        "paragraphs": paragraphs,
        "tables": tables_data,
        "full_text": full_text,
    }


def compare_docx(orig_bytes: bytes, up_bytes: bytes, orig_name: str, up_name: str) -> Dict[str, Any]:
    """
    Compare original and uploaded Microsoft Word (.docx) documents.
    Extracts paragraphs and tables, preserves structural context, identifies modifications.
    """
    try:
        orig_data = extract_docx_elements(orig_bytes)
    except Exception as e:
        return {
            "file_type": "docx",
            "comparison_method": "DOCX Document Structure Analysis (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not parse original DOCX: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "structural_details": {"error": str(e)},
        }

    try:
        up_data = extract_docx_elements(up_bytes)
    except Exception as e:
        return {
            "file_type": "docx",
            "comparison_method": "DOCX Document Structure Analysis (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not parse uploaded DOCX: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "structural_details": {"error": str(e)},
        }

    matcher = difflib.SequenceMatcher(None, orig_data["full_text"], up_data["full_text"])
    sim_ratio = matcher.ratio()
    similarity_pct = round(sim_ratio * 100.0, 2)
    change_pct = round(max(0.0, 100.0 - similarity_pct), 2)

    # Paragraph comparison
    p_orig = orig_data["paragraphs"]
    p_up = up_data["paragraphs"]
    p_matcher = difflib.SequenceMatcher(None, p_orig, p_up)

    added_sections: List[str] = []
    removed_sections: List[str] = []
    modified_sections: List[Dict[str, Any]] = []

    for tag, i1, i2, j1, j2 in p_matcher.get_opcodes():
        if tag == "replace":
            for k, (o_idx, u_idx) in enumerate(zip(range(i1, i2), range(j1, j2))):
                if len(modified_sections) < 15:
                    modified_sections.append({
                        "section": f"Paragraph {o_idx + 1}",
                        "original": p_orig[o_idx][:350],
                        "modified": p_up[u_idx][:350],
                    })
        elif tag == "delete":
            for idx in range(i1, i2):
                if len(removed_sections) < 15:
                    removed_sections.append(f"[Para {idx + 1}] {p_orig[idx][:250]}")
        elif tag == "insert":
            for idx in range(j1, j2):
                if len(added_sections) < 15:
                    added_sections.append(f"[Para {idx + 1}] {p_up[idx][:250]}")

    summary = (
        f"DOCX Analysis: {len(added_sections)} paragraph(s) added, "
        f"{len(removed_sections)} removed, {len(modified_sections)} modified. "
        f"Document similarity: {similarity_pct}% ({change_pct}% changed)."
    )

    return {
        "file_type": "docx",
        "comparison_method": "DOCX Paragraph & Table Semantic Structure Analysis",
        "change_percentage": change_pct,
        "similarity_percentage": similarity_pct,
        "summary": summary,
        "added": added_sections,
        "removed": removed_sections,
        "modified": modified_sections,
        "structural_details": {
            "original_paragraphs": len(p_orig),
            "uploaded_paragraphs": len(p_up),
            "paragraph_delta": len(p_up) - len(p_orig),
            "original_tables_rows": len(orig_data["tables"]),
            "uploaded_tables_rows": len(up_data["tables"]),
        },
    }

