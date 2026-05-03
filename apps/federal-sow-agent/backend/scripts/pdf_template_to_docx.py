#!/usr/bin/env python3
"""
Convert a PDF template (e.g. SOW/PWS shell) to DOCX for upload as a *template* in Federal SOW Agent.

Why use this
    The pipeline extracts real heading hierarchy from DOCX. PDF templates only get plain-text
    excerpts plus guessed section lines, so structure is weaker. A converted DOCX usually yields
    better ``template_hints`` for the LLM.

What this does *not* guarantee
    PDF and DOCX are different models. Conversion is best-effort: paragraphs, many tables, and
    basic layout often transfer well; multi-column pages, nested tables, forms, and scanned
    (image-only) PDFs often need manual touch-up in Word before you rely on headings.

Usage
    pip install -r requirements-dev.txt
    python scripts/pdf_template_to_docx.py path/to/template.pdf -o path/to/template.docx

    Upload ``template.docx`` as the workspace template (not the PDF).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert a PDF file to DOCX for richer template outline extraction in Federal SOW Agent."
    )
    parser.add_argument("input_pdf", type=Path, help="Source PDF path")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        required=True,
        help="Output DOCX path (.docx suffix recommended)",
    )
    args = parser.parse_args()

    src = args.input_pdf.expanduser().resolve()
    dst = args.output.expanduser().resolve()

    if not src.is_file():
        print(f"error: input not found: {src}", file=sys.stderr)
        return 1
    if src.suffix.lower() != ".pdf":
        print("error: input must be a .pdf file", file=sys.stderr)
        return 1

    dst.parent.mkdir(parents=True, exist_ok=True)

    try:
        from pdf2docx import Converter
    except ImportError:
        print(
            "error: pdf2docx is not installed. From the backend directory run:\n"
            "  pip install -r requirements-dev.txt",
            file=sys.stderr,
        )
        return 1

    cv = Converter(str(src))
    try:
        cv.convert(str(dst))
    finally:
        cv.close()

    if not dst.is_file():
        print(f"error: conversion produced no file at {dst}", file=sys.stderr)
        return 1

    print(f"wrote {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
