import difflib
from typing import Dict, Any, List

def decode_text(data: bytes) -> str:
    """Safely decode text bytes using common encodings."""
    for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def compare_text(orig_bytes: bytes, up_bytes: bytes, orig_name: str, up_name: str) -> Dict[str, Any]:
    """
    Perform line-level and character-level text comparison.
    Calculates change percentage, similarity percentage, and extracts diff segments.
    """
    orig_text = decode_text(orig_bytes)
    up_text = decode_text(up_bytes)

    orig_lines = orig_text.splitlines()
    up_lines = up_text.splitlines()

    matcher = difflib.SequenceMatcher(None, orig_text, up_text)
    similarity_ratio = matcher.ratio()
    similarity_pct = round(similarity_ratio * 100.0, 2)
    change_pct = round(max(0.0, 100.0 - similarity_pct), 2)

    # Line-level diff analysis
    line_matcher = difflib.SequenceMatcher(None, orig_lines, up_lines)
    added_lines: List[str] = []
    removed_lines: List[str] = []
    modified_sections: List[Dict[str, Any]] = []

    for tag, i1, i2, j1, j2 in line_matcher.get_opcodes():
        if tag == "replace":
            orig_segment = "\n".join(orig_lines[i1:i2])
            up_segment = "\n".join(up_lines[j1:j2])
            modified_sections.append({
                "original_line_range": f"{i1 + 1}-{i2}",
                "uploaded_line_range": f"{j1 + 1}-{j2}",
                "original": orig_segment[:500],
                "modified": up_segment[:500],
            })
        elif tag == "delete":
            for line in orig_lines[i1:i2]:
                if len(removed_lines) < 20:
                    removed_lines.append(line[:300])
        elif tag == "insert":
            for line in up_lines[j1:j2]:
                if len(added_lines) < 20:
                    added_lines.append(line[:300])

    summary = (
        f"Text analysis: {len(added_lines)} line(s) added, "
        f"{len(removed_lines)} line(s) removed, {len(modified_sections)} section(s) modified. "
        f"Calculated content similarity is {similarity_pct}% ({change_pct}% changed)."
    )

    return {
        "file_type": "txt",
        "comparison_method": "Character & Line-Level Sequence Comparison",
        "change_percentage": change_pct,
        "similarity_percentage": similarity_pct,
        "summary": summary,
        "added": added_lines,
        "removed": removed_lines,
        "modified": modified_sections,
        "structural_details": {
            "original_lines": len(orig_lines),
            "uploaded_lines": len(up_lines),
            "line_delta": len(up_lines) - len(orig_lines),
            "character_delta": len(up_text) - len(orig_text),
        },
    }

