import io
from fpdf import FPDF
from typing import Dict, Any

class SourceMarkReportPDF(FPDF):
    def header(self):
        self.set_fill_color(10, 14, 26)
        self.rect(0, 0, 210, 20, "F")
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 4)
        self.cell(0, 10, "TRUSTSPHERE AI - SOURCEMARK INTEGRITY & CHANGE REPORT", ln=False)
        self.set_text_color(0, 0, 0)
        self.ln(20)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 10, f"TrustSphere AI Cryptographic Integrity Suite | Page {self.page_no()}", align="C")


def generate_sourcemark_pdf_report(comparison: Dict[str, Any]) -> bytes:
    """Generate a clean, structured PDF report for SourceMark verification and comparison."""
    pdf = SourceMarkReportPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    comp_id = comparison.get("comparison_id", "N/A")
    status = comparison.get("verification_status", "UNKNOWN")
    is_match = (status == "MATCH")

    # Status Banner
    if is_match:
        pdf.set_fill_color(220, 252, 231)  # Soft emerald
        pdf.set_text_color(22, 101, 52)
        status_label = "VERIFIED - INTEGRITY CONFIRMED (0% CHANGE)"
    else:
        pdf.set_fill_color(254, 226, 226)  # Soft red
        pdf.set_text_color(153, 27, 27)
        status_label = f"MODIFIED - CHANGE DETECTED ({comparison.get('change_percentage', 0.0)}% DIFFERENCE)"

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 12, status_label, border=1, ln=True, align="C", fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)

    # Executive Summary Card
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "1. Executive Verification Summary", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5, comparison.get("summary", "Analysis completed."))
    pdf.ln(3)

    # Key Metrics
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Report ID:", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(50, 6, comp_id, border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Analysis Timestamp:", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(50, 6, comparison.get("timestamp", "N/A")[:19], border=0, ln=True)

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Comparison Method:", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(50, 6, comparison.get("comparison_method", "N/A")[:30], border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 6, "Similarity Score:", border=0)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(50, 6, f"{comparison.get('similarity_percentage', 0.0)}%", border=0, ln=True)
    pdf.ln(4)

    # File Integrity Comparison Table
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "2. Cryptographic & File Metadata Comparison", ln=True)

    orig_meta = comparison.get("original_integrity", {})
    up_meta = comparison.get("uploaded_integrity", {})

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(240, 240, 245)
    pdf.cell(40, 7, "Property", border=1, fill=True)
    pdf.cell(75, 7, "Registered Original", border=1, fill=True)
    pdf.cell(75, 7, "Submitted Upload", border=1, fill=True, ln=True)

    rows = [
        ("Filename", orig_meta.get("filename", "N/A"), up_meta.get("filename", "N/A")),
        ("File Size", f"{orig_meta.get('size', 0):,} bytes", f"{up_meta.get('size', 0):,} bytes"),
        ("SHA-256 (64-hex)", orig_meta.get("hash", "N/A"), up_meta.get("hash", "N/A")),
    ]

    pdf.set_font("Helvetica", "", 8)
    for label, orig_val, up_val in rows:
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(40, 6, label, border=1)
        pdf.set_font("Helvetica", "", 7 if "SHA" in label else 8)
        pdf.cell(75, 6, str(orig_val)[:48], border=1)
        pdf.cell(75, 6, str(up_val)[:48], border=1, ln=True)
    pdf.ln(4)

    # Detailed Differential Breakdown
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "3. Detected Modifications & Structural Variance", ln=True)

    added = comparison.get("added", [])
    removed = comparison.get("removed", [])
    modified = comparison.get("modified", [])

    if not added and not removed and not modified:
        pdf.set_font("Helvetica", "I", 9)
        pdf.cell(0, 6, "No structural differences detected (0.0% variance).", ln=True)
    else:
        if added:
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(22, 101, 52)
            pdf.cell(0, 6, f"+ Added Content / Entries ({len(added)}):", ln=True)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(0, 0, 0)
            for item in added[:6]:
                pdf.cell(0, 5, f"  * {str(item)[:90]}", ln=True)

        if removed:
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(153, 27, 27)
            pdf.cell(0, 6, f"- Removed Content / Entries ({len(removed)}):", ln=True)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(0, 0, 0)
            for item in removed[:6]:
                pdf.cell(0, 5, f"  * {str(item)[:90]}", ln=True)

        if modified:
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(194, 65, 12)
            pdf.cell(0, 6, f"~ Modified Sections ({len(modified)}):", ln=True)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(0, 0, 0)
            for mod in modified[:5]:
                sec = mod.get("section", "Section")
                pdf.set_font("Helvetica", "B", 8)
                pdf.cell(0, 5, f"  [{sec}]", ln=True)
                pdf.set_font("Helvetica", "", 7)
                pdf.cell(0, 4, f"    Original: {mod.get('original', '')[:100]}", ln=True)
                pdf.cell(0, 4, f"    Modified: {mod.get('modified', '')[:100]}", ln=True)

    pdf.ln(5)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(120, 120, 120)
    pdf.multi_cell(0, 4, "Security Notice: This document is an automated integrity audit report produced by TrustSphere AI. SHA-256 cryptographic verification serves as the sole authoritative determinant of file authenticity. Content change analysis estimates textual, pixel, or archive variance.")

    return bytes(pdf.output())

