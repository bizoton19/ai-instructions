"""Optional OCR for images (diagrams, ERD screenshots)."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


def extract_image_text_or_placeholder(path: Path) -> tuple[str, dict]:
    meta: dict = {"filename": path.name}
    try:
        import pytesseract

        img = Image.open(path)
        meta["size"] = img.size
        text = pytesseract.image_to_string(img)
        text = (text or "").strip()
        if text:
            meta["ocr"] = True
            return text, meta
    except Exception as e:
        meta["ocr_error"] = str(e)

    meta["ocr"] = False
    placeholder = (
        "[Image uploaded: OCR unavailable or no text detected. "
        "Describe the diagram in chat or paste key requirements.]"
    )
    return placeholder, meta


def meta_json(meta: dict) -> str:
    return json.dumps(meta)
