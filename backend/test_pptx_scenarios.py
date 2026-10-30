"""
PPTX Content-Level Comparison & Re-Save Analysis Test Suite.
Tests all 6 required PPTX scenarios and verifies slide-level precision.
"""

import io
import os
import sys
import requests
from pptx import Presentation
from pptx.util import Inches, Pt
from app.services.comparison.pptx_comparison import compare_pptx, extract_pptx_slides
from app.services.hashing_service import sha256_bytes

BASE = "http://127.0.0.1:8000"
PASS = []
FAIL = []

def ok(name):
    print(f"  [PASS] {name}")
    PASS.append(name)

def fail(name, reason=""):
    print(f"  [FAIL] {name}" + (f" -- {reason}" if reason else ""))
    FAIL.append(name)

def make_presentation(slides_content: list) -> bytes:
    """
    Generate an in-memory PPTX presentation from a list of slide dicts:
    [{"title": "...", "body": "...", "bullets": ["...", "..."], "table": [["...", "..."]]}]
    """
    prs = Presentation()
    blank_layout = prs.slide_layouts[6]  # Blank slide

    for s_data in slides_content:
        slide = prs.slides.add_slide(blank_layout)

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.5), Inches(9), Inches(1))
        tf = title_box.text_frame
        tf.text = s_data.get("title", "")

        # Body / Bullets
        body_text = s_data.get("body", "")
        bullets = s_data.get("bullets", [])
        if body_text or bullets:
            content_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.8), Inches(9), Inches(3))
            c_tf = content_box.text_frame
            if body_text:
                c_tf.text = body_text
            for b in bullets:
                p = c_tf.add_paragraph()
                p.text = b
                p.level = 1

        # Table if present
        table_data = s_data.get("table")
        if table_data:
            rows = len(table_data)
            cols = len(table_data[0]) if rows > 0 else 0
            shape = slide.shapes.add_table(rows, cols, Inches(0.5), Inches(4.5), Inches(8), Inches(1.5))
            table = shape.table
            for r_idx, row in enumerate(table_data):
                for c_idx, cell_value in enumerate(row):
                    table.cell(r_idx, c_idx).text = cell_value

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


# Standard 5-slide test presentation
BASE_SLIDES = [
    {
        "title": "TrustSphere AI Project Overview",
        "body": "Executive summary of TrustSphere security architecture.",
        "bullets": ["Cryptographic assurance", "Decentralized trust", "Real-time auditing"],
    },
    {
        "title": "System Architecture",
        "body": "Multi-tier microservice architecture with FastAPI and MySQL.",
        "bullets": ["Frontend: React + Vite", "Backend: FastAPI", "Database: MySQL 8"],
    },
    {
        "title": "Team Directory",
        "body": "Lead Project Engineers and Researchers",
        "bullets": [
            "Project Lead: Priya Sharma",
            "Student Name: Rahul",
            "Security Analyst: Vikram Malhotra",
        ],
    },
    {
        "title": "Key Deliverables & Milestones",
        "body": "Deliverables for Hackathon Evaluation",
        "bullets": ["SourceMark 2.0 Integration", "ProvenanceGuard Rollback Protection", "Key Lifecycle Management"],
    },
    {
        "title": "Audit Summary Table",
        "body": "Summary of cryptographic records",
        "table": [
            ["Module", "Status", "Verification"],
            ["SourceMark", "Active", "SHA-256"],
            ["EvidenceLock", "Active", "Hash Chain"],
        ],
    },
]

print("\n" + "=" * 65)
print("  TRUSTSPHERE AI -- PPTX CONTENT COMPARISON & RE-SAVE TESTS")
print("=" * 65)

# --- Test 1: Exact Copy ---
print("\n[Test 1] Exact copy: same PPTX uploaded twice")
orig_bytes = make_presentation(BASE_SLIDES)
orig_hash = sha256_bytes(orig_bytes)

# Compare exact bytes
res1 = compare_pptx(orig_bytes, orig_bytes, "AfterHours_SourceMark.pptx", "AfterHours_SourceMark.pptx")
struct1 = res1.get("structural_details", {})

if (res1.get("similarity_percentage") == 100.0 and
    struct1.get("unchanged_slides_count") == 5 and
    struct1.get("modified_slides_count") == 0 and
    struct1.get("added_slides_count") == 0 and
    struct1.get("removed_slides_count") == 0):
    ok("Exact copy: 100.0% similarity, 5/5 slides UNCHANGED, 0 modified")
else:
    fail("Exact copy", f"sim={res1.get('similarity_percentage')}, details={struct1}")


# --- Test 2: Re-saved Presentation (Re-saving without visible content change) ---
print("\n[Test 2] Re-saved presentation: re-saved without content edit")
# Creating fresh presentation with identical visible content
# (Generates different internal zip CRC and timestamp metadata)
resaved_bytes = make_presentation(BASE_SLIDES)
resaved_hash = sha256_bytes(resaved_bytes)

res2 = compare_pptx(orig_bytes, resaved_bytes, "AfterHours_SourceMark.pptx", "AfterHours_SourceMark_Resaved.pptx")
struct2 = res2.get("structural_details", {})

if (res2.get("similarity_percentage") >= 99.9 and
    struct2.get("unchanged_slides_count") == 5 and
    struct2.get("modified_slides_count") == 0):
    ok(f"Re-saved: {res2.get('similarity_percentage')}% content similarity, 5/5 slides UNCHANGED (SHA-256 distinct)")
else:
    fail("Re-saved presentation", f"sim={res2.get('similarity_percentage')}, details={struct2}")


# --- Test 3: One Name Changed (Slide 3: Rahul -> Arjun) ---
print("\n[Test 3] Single name change on one slide (Rahul -> Arjun on Slide 3)")
name_changed_slides = [dict(s) for s in BASE_SLIDES]
# Deep copy bullets of slide 3
name_changed_slides[2] = {
    "title": "Team Directory",
    "body": "Lead Project Engineers and Researchers",
    "bullets": [
        "Project Lead: Priya Sharma",
        "Student Name: Arjun",  # Changed from Rahul
        "Security Analyst: Vikram Malhotra",
    ],
}
changed_bytes = make_presentation(name_changed_slides)

res3 = compare_pptx(orig_bytes, changed_bytes, "AfterHours_SourceMark.pptx", "AfterHours_SourceMark_Modified.pptx")
struct3 = res3.get("structural_details", {})
slide3_detail = next((s for s in struct3.get("slide_details", []) if s.get("slide_number") == 3), None)

if (struct3.get("modified_slides_count") == 1 and
    struct3.get("unchanged_slides_count") == 4 and
    res3.get("affected_pages") == [3] and
    slide3_detail and slide3_detail.get("status") == "MODIFIED" and
    "Rahul" in slide3_detail.get("original_text", "") and
    "Arjun" in slide3_detail.get("modified_text", "") and
    res3.get("similarity_percentage") >= 95.0):
    ok(f"Single name change: Detected Slide 3 MODIFIED, 4 UNCHANGED, similarity={res3.get('similarity_percentage')}%")
    print(f"    - Original Text Snippet: ...Student Name: Rahul...")
    print(f"    - Modified Text Snippet: ...Student Name: Arjun...")
else:
    fail("Single name change", f"affected={res3.get('affected_pages')}, details={struct3}, sim={res3.get('similarity_percentage')}")


# --- Test 4: Slide Added ---
print("\n[Test 4] Slide added: 6 slides uploaded vs 5 original")
added_slides = list(BASE_SLIDES) + [
    {
        "title": "New Appendix Slide",
        "body": "Additional architectural reference diagrams.",
        "bullets": ["Reference Architecture v2.4", "Security Policy ISO 27001"],
    }
]
added_bytes = make_presentation(added_slides)

res4 = compare_pptx(orig_bytes, added_bytes, "presentation.pptx", "presentation_added.pptx")
struct4 = res4.get("structural_details", {})

if (struct4.get("added_slides_count") == 1 and
    struct4.get("unchanged_slides_count") == 5 and
    struct4.get("modified_slides_count") == 0):
    ok("Slide added: 1 ADDED slide detected, 5 UNCHANGED")
else:
    fail("Slide added", f"details={struct4}")


# --- Test 5: Slide Removed ---
print("\n[Test 5] Slide removed: 4 slides uploaded vs 5 original")
removed_slides = [BASE_SLIDES[0], BASE_SLIDES[1], BASE_SLIDES[3], BASE_SLIDES[4]]  # Removed slide 3
removed_bytes = make_presentation(removed_slides)

res5 = compare_pptx(orig_bytes, removed_bytes, "presentation.pptx", "presentation_removed.pptx")
struct5 = res5.get("structural_details", {})

if (struct5.get("removed_slides_count") == 1 and
    struct5.get("unchanged_slides_count") == 4 and
    struct5.get("modified_slides_count") == 0):
    ok("Slide removed: 1 REMOVED slide detected, 4 UNCHANGED")
else:
    fail("Slide removed", f"details={struct5}")


# --- Test 6: Multiple Text Changes Across Multiple Slides ---
print("\n[Test 6] Multiple text changes across multiple slides (Slides 1 & 3)")
multi_changed_slides = [dict(s) for s in BASE_SLIDES]
multi_changed_slides[0] = {
    "title": "TrustSphere AI Enterprise Security Suite",  # Changed title
    "body": "Updated executive roadmap for security compliance.",  # Changed body
    "bullets": ["Zero Trust Architecture", "Cryptographic Assurance"],
}
multi_changed_slides[2] = {
    "title": "Personnel & Team Directory",  # Changed title
    "body": "Core development contributors",
    "bullets": ["Lead: Priya Sharma", "Student Name: Arjun", "Vikram Malhotra"],
}
multi_bytes = make_presentation(multi_changed_slides)

res6 = compare_pptx(orig_bytes, multi_bytes, "presentation.pptx", "presentation_multichange.pptx")
struct6 = res6.get("structural_details", {})

if (struct6.get("modified_slides_count") == 2 and
    struct6.get("unchanged_slides_count") == 3 and
    1 in res6.get("affected_pages") and
    3 in res6.get("affected_pages")):
    ok(f"Multiple text changes: Correctly identified Slides {res6.get('affected_pages')} MODIFIED, 3 UNCHANGED")
else:
    fail("Multiple text changes", f"affected={res6.get('affected_pages')}, details={struct6}")


# --- Test 7: End-to-End API Test with Re-Save Analysis (/api/provenanceguard/analyze-resave) ---
print("\n[Test 7] End-to-End API Test (/api/provenanceguard/analyze-resave)")
try:
    # 1. Register the original PPTX via SourceMark
    reg_r = requests.post(
        f"{BASE}/api/sourcemark/upload",
        files={"file": ("AfterHours_SourceMark.pptx", io.BytesIO(orig_bytes), "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
    )
    if reg_r.status_code == 200:
        orig_file_id = reg_r.json()["id"]
        print(f"    Registered original PPTX: ID {orig_file_id}")

        # 2. Upload the single name changed PPTX to /api/provenanceguard/analyze-resave
        analysis_r = requests.post(
            f"{BASE}/api/provenanceguard/analyze-resave",
            data={"original_file_id": orig_file_id},
            files={"file": ("AfterHours_SourceMark_Resaved.pptx", io.BytesIO(changed_bytes), "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
        )

        if analysis_r.status_code == 200:
            api_data = analysis_r.json()
            comp = api_data.get("comparison", {})
            struct = comp.get("structural_details", {})

            print(f"    API Status: 200 OK")
            print(f"    Classification: {api_data.get('classification')}")
            print(f"    Similarity: {comp.get('similarity_percentage')}%")
            print(f"    Method: {comp.get('comparison_method')}")
            print(f"    Affected Slides: {comp.get('affected_pages')}")
            print(f"    Unchanged Slides: {struct.get('unchanged_slides_count')}")
            print(f"    Modified Slides: {struct.get('modified_slides_count')}")

            if (comp.get("similarity_percentage") >= 90.0 and
                struct.get("modified_slides_count") == 1 and
                struct.get("unchanged_slides_count") == 4 and
                comp.get("affected_pages") == [3] and
                api_data.get("classification") in ("CONTENT_SIMILAR", "POSSIBLE_DERIVATIVE")):
                ok("End-to-End API Re-Save Analysis: Highly accurate slide-level comparison reported!")
            else:
                fail("API Analysis output mismatch", str(api_data)[:300])
        else:
            fail("API Call /analyze-resave", f"HTTP {analysis_r.status_code}: {analysis_r.text[:300]}")
    else:
        fail("Register original PPTX", f"HTTP {reg_r.status_code}: {reg_r.text[:300]}")
except Exception as e:
    fail("End-to-End API Test exception", str(e))


# --- Summary ---
print("\n" + "=" * 65)
total = len(PASS) + len(FAIL)
print(f"  TEST SUMMARY: {len(PASS)}/{total} PASSED")
if FAIL:
    print("  FAILED:")
    for f in FAIL:
        print(f"    - {f}")
    sys.exit(1)
else:
    print("  ALL PPTX TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)
    sys.exit(0)

