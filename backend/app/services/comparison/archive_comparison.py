import io
import zipfile
from typing import Dict, Any, List

MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024  # 250 MB max uncompressed
MAX_ZIP_ENTRIES = 5000
MAX_COMPRESSION_RATIO = 100.0


def inspect_zip_safely(data: bytes) -> Dict[str, Dict[str, Any]]:
    """
    Safely inspect a ZIP archive without writing to disk.
    Guards against ZIP bombs, path traversal, and decompression attacks.
    """
    total_uncompressed = 0
    entries: Dict[str, Dict[str, Any]] = {}

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        infolist = zf.infolist()
        if len(infolist) > MAX_ZIP_ENTRIES:
            raise ValueError(f"ZIP archive contains {len(infolist)} entries, exceeding safety limit of {MAX_ZIP_ENTRIES}.")

        for info in infolist:
            name = info.filename
            # Path traversal check
            if ".." in name or name.startswith("/") or name.startswith("\\") or (len(name) > 1 and name[1] == ":"):
                raise ValueError(f"Security violation: Suspicious path detected in archive: '{name}'")

            total_uncompressed += info.file_size
            if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
                raise ValueError("Security violation: Archive exceeds maximum uncompressed size limit (potential ZIP bomb).")

            if info.compress_size > 0:
                ratio = info.file_size / info.compress_size
                if ratio > MAX_COMPRESSION_RATIO and info.file_size > 10 * 1024 * 1024:
                    raise ValueError(f"Security violation: High compression ratio ({ratio:.1f}x) detected in '{name}'.")

            entries[name] = {
                "size": info.file_size,
                "crc": info.CRC,
                "is_dir": info.is_dir(),
            }

    return entries


def compare_zip(orig_bytes: bytes, up_bytes: bytes, orig_name: str, up_name: str) -> Dict[str, Any]:
    """
    Compare original and uploaded ZIP archives safely.
    Identifies added, deleted, and modified archive entries.
    """
    try:
        orig_entries = inspect_zip_safely(orig_bytes)
    except Exception as e:
        return {
            "file_type": "zip",
            "comparison_method": "Archive Manifest & Integrity Analysis (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not inspect original archive: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "structural_details": {"error": str(e)},
        }

    try:
        up_entries = inspect_zip_safely(up_bytes)
    except Exception as e:
        return {
            "file_type": "zip",
            "comparison_method": "Archive Manifest & Integrity Analysis (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not inspect uploaded archive: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "structural_details": {"error": str(e)},
        }

    orig_names = set(orig_entries.keys())
    up_names = set(up_entries.keys())

    added_files: List[str] = sorted(list(up_names - orig_names))
    removed_files: List[str] = sorted(list(orig_names - up_names))
    common_names = orig_names & up_names

    modified_files: List[Dict[str, Any]] = []
    unchanged_count = 0

    for name in common_names:
        o_info = orig_entries[name]
        u_info = up_entries[name]
        if o_info["crc"] != u_info["crc"] or o_info["size"] != u_info["size"]:
            modified_files.append({
                "section": f"File: {name}",
                "original": f"Size: {o_info['size']:,} B | CRC: {hex(o_info['crc'])}",
                "modified": f"Size: {u_info['size']:,} B | CRC: {hex(u_info['crc'])}",
            })
        else:
            unchanged_count += 1

    all_keys = orig_names | up_names
    total_items = max(len(all_keys), 1)
    changed_items = len(added_files) + len(removed_files) + len(modified_files)

    change_pct = round(min(100.0, (changed_items / total_items) * 100.0), 2)
    similarity_pct = round(max(0.0, 100.0 - change_pct), 2)

    summary = (
        f"Archive Differential Analysis: {len(added_files)} file(s) added, "
        f"{len(removed_files)} file(s) removed, {len(modified_files)} file(s) modified, "
        f"{unchanged_count} file(s) intact. Calculated archive similarity is {similarity_pct}%."
    )

    return {
        "file_type": "zip",
        "comparison_method": "Safe Archive Manifest & CRC32 Payload Analysis",
        "change_percentage": change_pct,
        "similarity_percentage": similarity_pct,
        "summary": summary,
        "added": [f"+ {f}" for f in added_files[:20]],
        "removed": [f"- {f}" for f in removed_files[:20]],
        "modified": modified_files[:20],
        "structural_details": {
            "original_entries_count": len(orig_entries),
            "uploaded_entries_count": len(up_entries),
            "added_count": len(added_files),
            "removed_count": len(removed_files),
            "modified_count": len(modified_files),
            "unchanged_count": unchanged_count,
        },
    }

