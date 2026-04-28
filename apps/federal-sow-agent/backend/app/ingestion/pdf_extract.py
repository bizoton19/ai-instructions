"""Extract text from PDF."""

from __future__ import annotations

from pathlib import Path

import pdfplumber


def extract_pdf_text(path: Path) -> tuple[str, dict]:
    chunks: list[str] = []
    meta: dict = {"pages": 0}
    with pdfplumber.open(str(path)) as pdf:
        meta["pages"] = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            t = page.extract_text() or ""
            if t.strip():
                chunks.append(f"--- Page {i + 1} ---\n{t.strip()}")
    return "\n\n".join(chunks), meta
