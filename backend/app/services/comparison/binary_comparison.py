import difflib
from typing import Dict, Any, List

def compare_binary(orig_bytes: bytes, up_bytes: bytes, orig_name: str, up_name: str) -> Dict[str, Any]:
    """
    Compare generic binary files at the byte stream level.
    Calculates size delta, changed byte percentage, and similarity.
    """
    orig_len = len(orig_bytes)
    up_len = len(up_bytes)
    max_len = max(orig_len, up_len)

    if max_len == 0:
        return {
            "file_type": "binary",
            "comparison_method": "Byte-Level Binary Analysis",
            "change_percentage": 0.0,
            "similarity_percentage": 100.0,
            "summary": "Both files are empty (0 bytes).",
            "added": [],
            "removed": [],
            "modified": [],
            "structural_details": {"size": 0},
        }

    # Sample for SequenceMatcher if files are large (> 256 KB)
    # to maintain high responsiveness in Python
    sample_size = min(250_000, max_len)
    s_orig = orig_bytes[:sample_size]
    s_up = up_bytes[:sample_size]

    matcher = difflib.SequenceMatcher(None, s_orig, s_up)
    ratio = matcher.ratio()

    # Factor in length mismatch if sizes differ beyond sample
    len_penalty = abs(orig_len - up_len) / max_len
    adjusted_sim = max(0.0, ratio * (1.0 - 0.5 * len_penalty))

    similarity_pct = round(adjusted_sim * 100.0, 2)
    change_pct = round(max(0.0, 100.0 - similarity_pct), 2)

    # Count differing bytes across common length
    common_len = min(orig_len, up_len)
    differing_bytes = sum(1 for a, b in zip(orig_bytes[:10000], up_bytes[:10000]) if a != b)
    if common_len > 10000:
        differing_bytes = int(differing_bytes * (common_len / 10000))

    modifications: List[Dict[str, Any]] = []
    if orig_len != up_len:
        modifications.append({
            "section": "File Size Differential",
            "original": f"{orig_len:,} bytes",
            "modified": f"{up_len:,} bytes ({'+' if up_len > orig_len else ''}{up_len - orig_len} bytes)",
        })
    if differing_bytes > 0:
        modifications.append({
            "section": "Byte Divergence",
            "original": f"Baseline stream (sample: {min(common_len, 10000):,} bytes)",
            "modified": f"Detected ~{differing_bytes:,} differing bytes in payload",
        })

    summary = (
        f"Byte-Level Binary Analysis: File sizes differ by {abs(up_len - orig_len):,} bytes. "
        f"Estimated payload similarity is {similarity_pct}% ({change_pct}% divergence). "
        f"(Note: Byte-level comparison reflects binary encoding differences, not semantic changes)."
    )

    return {
        "file_type": "binary",
        "comparison_method": "Byte-Level Binary Analysis (Heuristic)",
        "change_percentage": change_pct,
        "similarity_percentage": similarity_pct,
        "summary": summary,
        "added": [f"+ {up_len - orig_len:,} bytes payload growth"] if up_len > orig_len else [],
        "removed": [f"- {orig_len - up_len:,} bytes payload reduction"] if orig_len > up_len else [],
        "modified": modifications,
        "structural_details": {
            "heuristic": True,
            "original_size_bytes": orig_len,
            "uploaded_size_bytes": up_len,
            "size_delta_bytes": up_len - orig_len,
            "estimated_divergent_bytes": differing_bytes,
        },
    }

