"""Merge generated SOW fields into Word templates."""

from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docxtpl import DocxTemplate

from app.schemas import SOWSectionsModel


def _has_jinja_placeholders(path: Path) -> bool:
    try:
        doc = Document(str(path))
        pattern = re.compile(r"\{\{\s*[\w.]+\s*\}\}")
        for p in doc.paragraphs:
            if pattern.search(p.text):
                return True
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        if pattern.search(p.text):
                            return True
        return False
    except Exception:
        return True


def merge_docx(
    template_path: Path,
    flat_context: dict[str, str],
    output_path: Path,
) -> tuple[bool, str]:
    """
    Returns (used_docxtpl, message).
    If docxtpl fails or no placeholders detected, appends sections as new document content.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    used_tpl = False
    msg_parts: list[str] = []

    if _has_jinja_placeholders(template_path):
        try:
            tpl = DocxTemplate(str(template_path))
            tpl.render(flat_context)
            tpl.save(str(output_path))
            used_tpl = True
            msg_parts.append("Rendered template with docxtpl.")
            return used_tpl, " ".join(msg_parts)
        except Exception as e:
            msg_parts.append(f"docxtpl render failed ({e}); using fallback.")

    doc = Document(str(template_path))
    doc.add_paragraph()
    doc.add_heading("Generated Statement of Work Content", level=1)
    order = [
        ("Purpose", flat_context.get("purpose", "")),
        ("Background", flat_context.get("background", "")),
        ("Scope", flat_context.get("scope", "")),
        ("Deliverables", flat_context.get("deliverables", "")),
        ("Period of Performance", flat_context.get("period_of_performance", "")),
        ("Roles and Responsibilities", flat_context.get("roles_and_responsibilities", "")),
        ("Acceptance Criteria", flat_context.get("acceptance_criteria", "")),
        ("Assumptions and Constraints", flat_context.get("assumptions_and_constraints", "")),
    ]
    body = flat_context.get("full_markdown") or ""
    for title, block in order:
        if block and str(block).strip():
            doc.add_heading(title, level=2)
            for line in str(block).splitlines():
                doc.add_paragraph(line)
    if body.strip():
        doc.add_heading("Full narrative (Markdown pasted as text)", level=2)
        for line in body.splitlines():
            doc.add_paragraph(line)

    doc.save(str(output_path))
    msg_parts.append("Fallback: appended generated sections to a copy of the template.")
    return used_tpl, " ".join(msg_parts)


def merge_docx_bytes(template_path: Path, flat_context: dict[str, str]) -> tuple[bytes, str]:
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        out_path = Path(tmp.name)
    try:
        _, msg = merge_docx(template_path, flat_context, out_path)
        return out_path.read_bytes(), msg
    finally:
        out_path.unlink(missing_ok=True)


def sow_model_to_flat(s: SOWSectionsModel) -> dict[str, str]:
    return {
        "purpose": s.purpose or "",
        "background": s.background or "",
        "scope": s.scope or "",
        "deliverables": s.deliverables or "",
        "period_of_performance": s.period_of_performance or "",
        "roles_and_responsibilities": s.roles_and_responsibilities or "",
        "acceptance_criteria": s.acceptance_criteria or "",
        "assumptions_and_constraints": s.assumptions_and_constraints or "",
        "full_markdown": s.full_markdown or "",
    }
