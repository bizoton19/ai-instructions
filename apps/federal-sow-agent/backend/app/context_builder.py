"""Shared workspace → LLM context block construction (documents + template hints)."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models import ContextAsset, TemplateAsset, Workspace


def build_generation_inputs(db: Session, workspace_id: str) -> tuple[str, str]:
    """Return (context_block, template_hints) capped for the SOW chain."""
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()

    contexts = (
        db.query(ContextAsset).filter(ContextAsset.workspace_id == workspace_id).order_by(ContextAsset.created_at.asc()).all()
    )
    templates = (
        db.query(TemplateAsset).filter(TemplateAsset.workspace_id == workspace_id).order_by(TemplateAsset.created_at.desc()).all()
    )

    context_block_parts: list[str] = []
    for c in contexts:
        context_block_parts.append(f"## {c.filename} ({c.kind})")
        if c.extracted_text:
            context_block_parts.append(c.extracted_text[:18000])
    context_block = "\n\n".join(context_block_parts)[:120000]

    template_hints_parts: list[str] = []
    chosen_templates = templates
    if ws and ws.active_template_asset_id:
        chosen_templates = [t for t in templates if t.id == ws.active_template_asset_id]
    for t in chosen_templates[:1]:
        if not t.extracted_outline_json:
            template_hints_parts.append(f"{t.filename}: [outline not extracted yet]")
            continue
        try:
            obj = json.loads(t.extracted_outline_json)
        except Exception:
            template_hints_parts.append(f"{t.filename}: [outline parse error]")
            continue

        kind = obj.get("kind")
        headings = obj.get("headings")
        # Legacy stored payload: {"headings": [...]} without kind.
        if kind is None and isinstance(headings, list):
            kind = "docx"

        if kind == "error":
            detail = obj.get("detail", "extract failed")
            template_hints_parts.append(f"{t.filename}: [template extract error — {detail}]")
            continue

        if kind in ("docx", None):
            hdrs = headings if isinstance(headings, list) else []
            if hdrs:
                template_hints_parts.append(f"{t.filename} (.docx): headings — {', '.join(str(h) for h in hdrs[:15])}")
            excerpt = (obj.get("text_excerpt") or "").strip()
            if excerpt:
                excerpt = excerpt[:7000]
                template_hints_parts.append(f"{t.filename}: excerpt:\n{excerpt}")
            continue

        if kind == "pdf":
            hdrs = headings if isinstance(headings, list) else []
            if hdrs:
                template_hints_parts.append(
                    f"{t.filename} (PDF): inferred section lines — {', '.join(str(h) for h in hdrs[:15])}"
                )
            pages = obj.get("pages")
            if pages:
                template_hints_parts.append(f"{t.filename}: {pages} page(s)")
            excerpt = (obj.get("text_excerpt") or "").strip()[:9000]
            if excerpt:
                template_hints_parts.append(f"{t.filename} (PDF) text excerpt:\n{excerpt}")
            template_hints_parts.append(
                "(PDF templates do not preserve exact typography in export; drafting should mirror section ideas in Word output.)"
            )
            continue

        if kind == "xlsx":
            sheet = obj.get("sheet") or ""
            hdr_row = obj.get("headers") or []
            if hdr_row:
                template_hints_parts.append(
                    f"{t.filename} (Excel, sheet «{sheet}»): columns — {', '.join(str(h) for h in hdr_row[:24])}"
                )
            rows = obj.get("sample_rows") or []
            if isinstance(rows, list) and rows:
                preview_lines: list[str] = []
                for r in rows[:40]:
                    if isinstance(r, list):
                        preview_lines.append(" | ".join(str(c)[:120] for c in r[:12]))
                    else:
                        preview_lines.append(str(r))
                trimmed = "\n".join(preview_lines)[:8000]
                template_hints_parts.append(f"{t.filename}: table preview:\n{trimmed}")
            template_hints_parts.append(
                "(Excel templates supply tabular structure for the model; merge export is still Word format built from drafted sections.)"
            )
            continue

        template_hints_parts.append(f"{t.filename}: [unknown template outline kind]")
    template_hints = "\n".join(template_hints_parts)

    return context_block, template_hints


def assemble_prior_pipeline_text(db: Session, session_id: str, max_chars: int = 56000) -> str:
    """Concatenate markdown from prior Pipeline phase assistant outputs for chaining."""
    from app.models import Message

    msgs = (
        db.query(Message)
        .filter(Message.session_id == session_id, Message.role == "assistant")
        .order_by(Message.created_at.asc())
        .all()
    )
    chunks: list[str] = []
    for m in msgs:
        c = (m.content or "").strip()
        if not c:
            continue
        marker = "## Pipeline phase"
        if marker in c or c.startswith("## Pipeline phase"):
            chunks.append(c)
    merged = (
        "\n\n--- CONTEXT FROM PRIOR PIPELINE PHASES ---\n\n".join(chunks)
        if chunks
        else ""
    )
    return merged.strip()[-max_chars:]
