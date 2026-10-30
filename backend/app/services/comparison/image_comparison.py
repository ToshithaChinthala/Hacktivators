import io
import base64
from typing import Dict, Any, Tuple, Optional
from PIL import Image

def get_image_preview_b64(img: Image.Image, max_dim: int = 240) -> str:
    """Generate a lightweight base64 JPEG data URL for browser thumbnail preview."""
    try:
        preview = img.copy()
        preview.thumbnail((max_dim, max_dim))
        if preview.mode in ("RGBA", "P"):
            preview = preview.convert("RGB")
        buf = io.BytesIO()
        preview.save(buf, format="JPEG", quality=75)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return ""


def compare_image(orig_bytes: bytes, up_bytes: bytes, orig_name: str, up_name: str) -> Dict[str, Any]:
    """
    Compare original and uploaded images pixel-by-pixel.
    Calculates changed pixel percentage, highlights bounding box, and creates thumbnails.
    """
    try:
        orig_img = Image.open(io.BytesIO(orig_bytes))
        orig_img.load()
    except Exception as e:
        return {
            "file_type": "image",
            "comparison_method": "Image Pixel Matrix Analysis (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not load original image: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "structural_details": {"error": str(e)},
        }

    try:
        up_img = Image.open(io.BytesIO(up_bytes))
        up_img.load()
    except Exception as e:
        return {
            "file_type": "image",
            "comparison_method": "Image Pixel Matrix Analysis (Error)",
            "change_percentage": 100.0,
            "similarity_percentage": 0.0,
            "summary": f"Could not load uploaded image: {str(e)}",
            "added": [],
            "removed": [],
            "modified": [],
            "structural_details": {"error": str(e)},
        }

    orig_w, orig_h = orig_img.size
    up_w, up_h = up_img.size

    # Convert to RGB for uniform pixel comparison
    orig_rgb = orig_img.convert("RGB")
    up_rgb = up_img.convert("RGB")

    max_w = max(orig_w, up_w)
    max_h = max(orig_h, up_h)
    total_pixels = max_w * max_h

    changed_pixels = 0
    min_x, min_y = max_w, max_h
    max_x, max_y = 0, 0

    # Dimension difference penalty
    dim_diff_pixels = abs(orig_w * orig_h - up_w * up_h)

    # Pixel comparison across common bounding area
    # Sub-sample if the image is massive (> 4K) to avoid performance lag
    step = 1
    if total_pixels > 4_000_000:
        step = 2

    common_w = min(orig_w, up_w)
    common_h = min(orig_h, up_h)

    orig_pix = orig_rgb.load()
    up_pix = up_rgb.load()

    diff_img = Image.new("RGBA", (common_w, common_h), (255, 255, 255, 255))
    diff_pix = diff_img.load()

    for y in range(0, common_h, step):
        for x in range(0, common_w, step):
            r1, g1, b1 = orig_pix[x, y]
            r2, g2, b2 = up_pix[x, y]
            # Euclidean color distance threshold (> 12 is noticeable change)
            dist_sq = (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
            if dist_sq > 144:
                changed_pixels += (step * step)
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
                # Mark difference in difference preview image
                for dy in range(step):
                    for dx in range(step):
                        if x + dx < common_w and y + dy < common_h:
                            diff_pix[x + dx, y + dy] = (239, 68, 68, 255) # Red highlight
            else:
                for dy in range(step):
                    for dx in range(step):
                        if x + dx < common_w and y + dy < common_h:
                            gray = int(0.299 * r1 + 0.587 * g1 + 0.114 * b1)
                            diff_pix[x + dx, y + dy] = (gray, gray, gray, 120)

    # Add dimension mismatch pixels
    changed_pixels += (total_pixels - (common_w * common_h))

    change_pct = round(min(100.0, (changed_pixels / max(total_pixels, 1)) * 100.0), 2)
    sim_pct = round(max(0.0, 100.0 - change_pct), 2)

    has_diff = (changed_pixels > 0)
    bbox_info = None
    if has_diff and max_x >= min_x and max_y >= min_y:
        bbox_info = {
            "x": min_x,
            "y": min_y,
            "width": max_x - min_x + 1,
            "height": max_y - min_y + 1,
        }

    orig_b64 = get_image_preview_b64(orig_img)
    up_b64 = get_image_preview_b64(up_img)
    diff_b64 = get_image_preview_b64(diff_img) if has_diff else None

    modifications = []
    if bbox_info:
        modifications.append({
            "section": "Changed Region Bounding Box",
            "original": f"Dimensions: {orig_w}x{orig_h} px",
            "modified": f"Modified zone: ({bbox_info['x']}, {bbox_info['y']}) to ({bbox_info['x'] + bbox_info['width']}, {bbox_info['y'] + bbox_info['height']})",
        })

    summary = (
        f"Image Matrix Analysis: {changed_pixels:,} of {total_pixels:,} pixels changed ({change_pct}% difference). "
        f"Calculated visual similarity is {sim_pct}%. "
        f"(Note: Pixel difference analysis does not interpret semantic context)."
    )

    return {
        "file_type": "image",
        "comparison_method": "RGB Pixel Matrix & Geometric Differential Analysis",
        "change_percentage": change_pct,
        "similarity_percentage": sim_pct,
        "summary": summary,
        "added": [f"New Dimensions: {up_w}x{up_h} px"] if (orig_w, orig_h) != (up_w, up_h) else [],
        "removed": [f"Original Dimensions: {orig_w}x{orig_h} px"] if (orig_w, orig_h) != (up_w, up_h) else [],
        "modified": modifications,
        "structural_details": {
            "original_dimensions": f"{orig_w}x{orig_h}",
            "uploaded_dimensions": f"{up_w}x{up_h}",
            "changed_pixels": changed_pixels,
            "total_pixels": total_pixels,
            "bounding_box": bbox_info,
            "original_preview": orig_b64,
            "uploaded_preview": up_b64,
            "orig_thumbnail_base64": orig_b64,
            "up_thumbnail_base64": up_b64,
            "diff_preview_base64": diff_b64,
        },
    }

