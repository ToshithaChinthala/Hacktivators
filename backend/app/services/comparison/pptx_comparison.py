"""
PowerPoint (.pptx) Presentation Content Comparison Service.
Extracts slide-level presentation text (titles, text frames, paragraphs, bullet points, tables),
compares slides individually, and calculates meaningful presentation similarity.
"""

import io
import re
import difflib
import zipfile
import logging
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _normalize_text(text: str) -> str:
    """Normalize whitespace for comparison while preserving words and structure."""
    if not text:
        return ""
    # Normalize unicode spaces and trailing/multiple whitespace
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def _extract_slide_text_pptx(data: bytes) -> List[Dict[str, Any]]:
    """
    Primary extractor: uses python-pptx to extract structured slide data.
    """
    from pptx import Presentation

    prs = Presentation(io.BytesIO(data))
    slides_data = []

    for idx, slide in enumerate(prs.slides, start=1):
        title = ""
        try:
            if slide.shapes.title and slide.shapes.title.text:
                title = slide.shapes.title.text.strip()
        except Exception:
            title = ""

        text_elements: List[str] = []

        def extract_from_shape(shape):
            nonlocal title
            try:
                # Text Frame (paragraphs, bullets)
                if shape.has_text_frame:
                    tf_text = shape.text_frame.text.strip()
                    if tf_text:
                        # If title wasn't found yet and shape looks like title
                        if not title and hasattr(shape, "name") and "title" in shape.name.lower():
                            title = tf_text.splitlines()[0]
                        text_elements.append(tf_text)

                # Tables
                if shape.has_table:
                    for row in shape.table.rows:
                        row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                        if row_cells:
                            text_elements.append(" | ".join(row_cells))

                # Group shapes
                if hasattr(shape, "shapes"):
                    for child_shape in shape.shapes:
                        extract_from_shape(child_shape)
            except Exception as e:
                logger.debug(f"Error extracting shape text: {e}")

        for shape in slide.shapes:
            extract_from_shape(shape)

        full_text = "\n".join(text_elements).strip()
        if not title:
            first_line = full_text.splitlines()[0] if full_text else ""
            title = first_line[:40] if first_line else f"Slide {idx}"

        slides_data.append({
            "slide_number": idx,
            "title": title,
            "text_elements": text_elements,
            "full_text": full_text,
        })

    return slides_data


def _extract_slide_text_xml_fallback(data: bytes) -> List[Dict[str, Any]]:
    """
    Fallback extractor: standard library zipfile + XML parsing for ppt/slides/slide*.xml.
    Ensures corrupted, non-standard, or exotic PPTX files can still be analyzed.
    """
    slides_data = []
    ns = {
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    }

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        slide_filenames = [n for n in zf.namelist() if re.match(r"^ppt/slides/slide\d+\.xml$", n)]

        def get_slide_num(name):
            m = re.search(r"slide(\d+)\.xml", name)
            return int(m.group(1)) if m else 9999

        slide_filenames.sort(key=get_slide_num)

        for idx, sname in enumerate(slide_filenames, start=1):
            try:
                xml_content = zf.read(sname)
                root = ET.fromstring(xml_content)
                paragraphs = []
                for p in root.findall(".//a:p", ns):
                    runs = [t.text for t in p.findall(".//a:t", ns) if t.text]
                    p_text = "".join(runs).strip()
                    if p_text:
                        paragraphs.append(p_text)

                full_text = "\n".join(paragraphs).strip()
                title = paragraphs[0][:40] if paragraphs else f"Slide {idx}"

                slides_data.append({
                    "slide_number": idx,
                    "title": title,
                    "text_elements": paragraphs,
                    "full_text": full_text,
                })
            except Exception as e:
                logger.warning(f"Fallback XML extractor failed on {sname}: {e}")
                slides_data.append({
                    "slide_number": idx,
                    "title": f"Slide {idx}",
                    "text_elements": [],
                    "full_text": "",
                })

    return slides_data


def extract_pptx_slides(data: bytes) -> List[Dict[str, Any]]:
    """
    Extract slide contents safely from PPTX binary data.
    Tries python-pptx first, then falls back to XML parser.
    """
    try:
        return _extract_slide_text_pptx(data)
    except Exception as e:
        logger.warning(f"python-pptx extraction failed: {e}. Falling back to XML extractor.")
        return _extract_slide_text_xml_fallback(data)


def _compute_text_diff(orig_text: str, up_text: str) -> List[Dict[str, str]]:
    """Compute line/chunk diff snippets between old text and new text."""
    orig_lines = [l.strip() for l in orig_text.splitlines() if l.strip()]
    up_lines = [l.strip() for l in up_text.splitlines() if l.strip()]

    sm = difflib.SequenceMatcher(None, orig_lines, up_lines)
    diffs = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "replace":
            diffs.append({
                "type": "replace",
                "original": " ".join(orig_lines[i1:i2]),
                "modified": " ".join(up_lines[j1:j2]),
            })
        elif tag == "delete":
            diffs.append({
                "type": "delete",
                "original": " ".join(orig_lines[i1:i2]),
                "modified": "",
            })
        elif tag == "insert":
            diffs.append({
                "type": "add",
                "original": "",
                "modified": " ".join(up_lines[j1:j2]),
            })
    return diffs


def compare_pptx(
    orig_bytes: bytes,
    up_bytes: bytes,
    orig_name: str,
    up_name: str,
) -> Dict[str, Any]:
    """
    Compare original and uploaded Microsoft PowerPoint (.pptx) presentations.
    Extracts text slide-by-slide, detects unchanged/modified/added/removed slides,
    pinpoints exact old vs. new text, and computes true content similarity.
    """
    try:
        orig_slides = extract_pptx_slides(orig_bytes)
    except Exception as e:
        return {
            "file_type": "pptx",
            "comparison_method": "PowerPoint Slide Content Analysis (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not parse original presentation: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "affected_pages": [],
            "structural_details": {"error": str(e)},
        }

    try:
        up_slides = extract_pptx_slides(up_bytes)
    except Exception as e:
        return {
            "file_type": "pptx",
            "comparison_method": "PowerPoint Slide Content Analysis (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not parse uploaded presentation: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "affected_pages": [],
            "structural_details": {"error": str(e)},
        }

    orig_count = len(orig_slides)
    up_count = len(up_slides)

    # Align slides using SequenceMatcher on normalized full_texts
    orig_texts = [_normalize_text(s["full_text"]) for s in orig_slides]
    up_texts = [_normalize_text(s["full_text"]) for s in up_slides]

    matcher = difflib.SequenceMatcher(None, orig_texts, up_texts)
    slide_details: List[Dict[str, Any]] = []
    affected_slides: List[int] = []
    modified_items: List[Dict[str, Any]] = []
    added_items: List[str] = []
    removed_items: List[str] = []

    total_sim_weight = 0.0
    total_slides_considered = max(orig_count, up_count, 1)

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for idx in range(i2 - i1):
                o_slide = orig_slides[i1 + idx]
                u_slide = up_slides[j1 + idx]
                slide_details.append({
                    "slide_number": u_slide["slide_number"],
                    "orig_slide_number": o_slide["slide_number"],
                    "title": u_slide["title"] or o_slide["title"],
                    "status": "UNCHANGED",
                    "original_text": o_slide["full_text"],
                    "modified_text": u_slide["full_text"],
                    "similarity_percentage": 100.0,
                    "diff_snippets": [],
                })
                total_sim_weight += 100.0

        elif tag == "replace":
            # Modified slides in this range
            range_len = max(i2 - i1, j2 - j1)
            for idx in range(range_len):
                has_orig = (i1 + idx < i2)
                has_up = (j1 + idx < j2)

                if has_orig and has_up:
                    o_slide = orig_slides[i1 + idx]
                    u_slide = up_slides[j1 + idx]
                    o_norm = orig_texts[i1 + idx]
                    u_norm = up_texts[j1 + idx]

                    # Slide text similarity
                    sm = difflib.SequenceMatcher(None, o_norm, u_norm)
                    slide_sim = round(sm.ratio() * 100.0, 2)
                    total_sim_weight += slide_sim

                    diff_snippets = _compute_text_diff(o_slide["full_text"], u_slide["full_text"])

                    slide_details.append({
                        "slide_number": u_slide["slide_number"],
                        "orig_slide_number": o_slide["slide_number"],
                        "title": u_slide["title"] or o_slide["title"],
                        "status": "MODIFIED",
                        "original_text": o_slide["full_text"],
                        "modified_text": u_slide["full_text"],
                        "similarity_percentage": slide_sim,
                        "diff_snippets": diff_snippets,
                    })
                    affected_slides.append(u_slide["slide_number"])

                    # Build modified record
                    diff_desc = []
                    for d in diff_snippets[:3]:
                        if d["type"] == "replace":
                            diff_desc.append(f"Changed '{d['original']}' -> '{d['modified']}'")
                        elif d["type"] == "delete":
                            diff_desc.append(f"Removed '{d['original']}'")
                        elif d["type"] == "add":
                            diff_desc.append(f"Added '{d['modified']}'")

                    snippet_str = "; ".join(diff_desc) if diff_desc else "Slide text modified"
                    modified_items.append({
                        "section": f"Slide {u_slide['slide_number']}: {u_slide['title']}",
                        "original": o_slide["full_text"] or "(empty)",
                        "modified": u_slide["full_text"] or "(empty)",
                        "diff_summary": snippet_str,
                    })

                elif has_up:
                    # Extra slide in uploaded
                    u_slide = up_slides[j1 + idx]
                    slide_details.append({
                        "slide_number": u_slide["slide_number"],
                        "orig_slide_number": None,
                        "title": u_slide["title"],
                        "status": "ADDED",
                        "original_text": "",
                        "modified_text": u_slide["full_text"],
                        "similarity_percentage": 0.0,
                        "diff_snippets": [{"type": "add", "original": "", "modified": u_slide["full_text"]}],
                    })
                    affected_slides.append(u_slide["slide_number"])
                    added_items.append(f"[Slide {u_slide['slide_number']} Added] {u_slide['title']}")

                elif has_orig:
                    # Slide removed in uploaded
                    o_slide = orig_slides[i1 + idx]
                    slide_details.append({
                        "slide_number": None,
                        "orig_slide_number": o_slide["slide_number"],
                        "title": o_slide["title"],
                        "status": "REMOVED",
                        "original_text": o_slide["full_text"],
                        "modified_text": "",
                        "similarity_percentage": 0.0,
                        "diff_snippets": [{"type": "delete", "original": o_slide["full_text"], "modified": ""}],
                    })
                    affected_slides.append(o_slide["slide_number"])
                    removed_items.append(f"[Slide {o_slide['slide_number']} Removed] {o_slide['title']}")

        elif tag == "delete":
            for idx in range(i1, i2):
                o_slide = orig_slides[idx]
                slide_details.append({
                    "slide_number": None,
                    "orig_slide_number": o_slide["slide_number"],
                    "title": o_slide["title"],
                    "status": "REMOVED",
                    "original_text": o_slide["full_text"],
                    "modified_text": "",
                    "similarity_percentage": 0.0,
                    "diff_snippets": [{"type": "delete", "original": o_slide["full_text"], "modified": ""}],
                })
                affected_slides.append(o_slide["slide_number"])
                removed_items.append(f"[Slide {o_slide['slide_number']} Removed] {o_slide['title']}")

        elif tag == "insert":
            for idx in range(j1, j2):
                u_slide = up_slides[idx]
                slide_details.append({
                    "slide_number": u_slide["slide_number"],
                    "orig_slide_number": None,
                    "title": u_slide["title"],
                    "status": "ADDED",
                    "original_text": "",
                    "modified_text": u_slide["full_text"],
                    "similarity_percentage": 0.0,
                    "diff_snippets": [{"type": "add", "original": "", "modified": u_slide["full_text"]}],
                })
                affected_slides.append(u_slide["slide_number"])
                added_items.append(f"[Slide {u_slide['slide_number']} Added] {u_slide['title']}")

    # Calculate overall similarity and change percentage
    # Also calculate whole presentation text similarity for fine-grained accuracy
    orig_full = "\n\n".join(orig_texts)
    up_full = "\n\n".join(up_texts)

    if orig_full == up_full:
        sim_pct = 100.0
    else:
        text_ratio = difflib.SequenceMatcher(None, orig_full, up_full).ratio() * 100.0
        slide_avg = total_sim_weight / total_slides_considered
        # Balanced blend: 60% whole-text ratio + 40% slide-weighted average
        sim_pct = round(0.6 * text_ratio + 0.4 * slide_avg, 2)
        # Ensure it stays within (0, 99.99] when differences exist
        sim_pct = max(0.0, min(99.99, sim_pct))

    change_pct = round(max(0.01, 100.0 - sim_pct), 2)

    unchanged_count = sum(1 for s in slide_details if s["status"] == "UNCHANGED")
    modified_count = sum(1 for s in slide_details if s["status"] == "MODIFIED")
    added_count = sum(1 for s in slide_details if s["status"] == "ADDED")
    removed_count = sum(1 for s in slide_details if s["status"] == "REMOVED")

    # Generate meaningful human-readable summary
    summary_parts = []
    if unchanged_count > 0:
        summary_parts.append(f"{unchanged_count} slide{'s' if unchanged_count != 1 else ''} unchanged")
    if modified_count > 0:
        mod_slides_str = ", ".join(f"Slide {s['slide_number']}" for s in slide_details if s["status"] == "MODIFIED")
        summary_parts.append(f"{modified_count} slide{'s' if modified_count != 1 else ''} modified ({mod_slides_str})")
    if added_count > 0:
        summary_parts.append(f"{added_count} slide{'s' if added_count != 1 else ''} added")
    if removed_count > 0:
        summary_parts.append(f"{removed_count} slide{'s' if removed_count != 1 else ''} removed")

    status_overview = "; ".join(summary_parts) if summary_parts else "All slides matched"
    summary = (
        f"PowerPoint Presentation Analysis: {status_overview}. "
        f"Overall presentation text similarity is {sim_pct:.1f}% ({change_pct:.2f}% content change)."
    )

    return {
        "file_type": "pptx",
        "comparison_method": "PowerPoint Presentation Slide-Level Content Analysis",
        "change_percentage": change_pct,
        "similarity_percentage": sim_pct,
        "summary": summary,
        "added": added_items,
        "removed": removed_items,
        "modified": modified_items,
        "affected_pages": sorted(list(set(affected_slides))),
        "structural_details": {
            "orig_slides_count": orig_count,
            "up_slides_count": up_count,
            "unchanged_slides_count": unchanged_count,
            "modified_slides_count": modified_count,
            "added_slides_count": added_count,
            "removed_slides_count": removed_count,
            "slide_details": slide_details,
        },
    }

