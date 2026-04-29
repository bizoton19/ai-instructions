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
        if t.extracted_outline_json:
            try:
                obj = json.loads(t.extracted_outline_json)
                headings = obj.get("headings", [])
                template_hints_parts.append(f"{t.filename}: {', '.join(headings[:15])}")
            except Exception:
                template_hints_parts.append(f"{t.filename}: [outline parse error]")
        else:
            template_hints_parts.append(f"{t.filename}: [outline not extracted yet]")
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
