"""Route files to the correct extractor."""

from __future__ import annotations

import mimetypes
from pathlib import Path

from app.ingestion.docx_extract import extract_docx_text_and_outline, outline_to_json
from app.ingestion.image_extract import extract_image_text_or_placeholder
from app.ingestion.pdf_extract import extract_pdf_text
from app.ingestion.tabular_extract import extract_csv_text, extract_xlsx_text


def guess_kind(filename: str, mime: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith(".docx"):
        return "docx"
    if lower.endswith(".xlsx") or lower.endswith(".xls"):
        return "xlsx"
    if lower.endswith(".csv"):
        return "csv"
    if lower.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".tiff")):
        return "image"
    mt = mime.lower()
    if "pdf" in mt:
        return "pdf"
    if "wordprocessingml" in mt or "msword" in mt:
        return "docx"
    if "spreadsheet" in mt or "excel" in mt:
        return "xlsx"
    if "csv" in mt:
        return "csv"
    if mt.startswith("image/"):
        return "image"
    return "other"


def ingest_context_file(path: Path, filename: str, mime: str) -> tuple[str, str, dict]:
    kind = guess_kind(filename, mime)
    meta: dict = {"kind": kind, "filename": filename}

    if kind == "pdf":
        text, pdf_meta = extract_pdf_text(path)
        meta.update(pdf_meta)
        return kind, text, meta

    if kind == "docx":
        text, outline = extract_docx_text_and_outline(path)
        meta["outline_headings"] = outline[:50]
        return kind, text, meta

    if kind == "csv":
        text, tab_meta = extract_csv_text(path)
        meta.update(tab_meta)
        return kind, text, meta

    if kind == "xlsx":
        text, tab_meta = extract_xlsx_text(path)
        meta.update(tab_meta)
        return kind, text, meta

    if kind == "image":
        text, im_meta = extract_image_text_or_placeholder(path)
        meta.update(im_meta)
        return kind, text, meta

    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8", errors="replace")[:500000]
    except Exception:
        text = "[Binary or unsupported file type]"
    meta["note"] = "fallback_decode"
    return "other", text, meta


def ingest_template_docx(path: Path) -> tuple[str, str]:
    text, outline = extract_docx_text_and_outline(path)
    return outline_to_json(outline), text


def normalize_mime(filename: str, declared: str | None) -> str:
    if declared and declared != "application/octet-stream":
        return declared
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"
