from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.agent.sow_chain import run_sow_chain
from app.database import get_db
from app.models import AgentSession, ContextAsset, Message, TemplateAsset, Workspace
from app.schemas import GenerateIn, GenerateOut

router = APIRouter(prefix="/workspaces/{workspace_id}/sessions/{session_id}", tags=["generate"])


def _must_workspace(db: Session, workspace_id: str, user_id: str) -> Workspace:
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws


@router.post("/generate", response_model=GenerateOut)
def generate_sow(
    workspace_id: str,
    session_id: str,
    payload: GenerateIn,
    db: Session = Depends(get_db),
):
    ws = _must_workspace(db, workspace_id, "local-user")
    session = db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    contexts = db.query(ContextAsset).filter(ContextAsset.workspace_id == workspace_id).order_by(ContextAsset.created_at.asc()).all()
    templates = db.query(TemplateAsset).filter(TemplateAsset.workspace_id == workspace_id).order_by(TemplateAsset.created_at.desc()).all()

    context_block_parts: list[str] = []
    for c in contexts:
        context_block_parts.append(f"## {c.filename} ({c.kind})")
        if c.extracted_text:
            context_block_parts.append(c.extracted_text[:18000])
    context_block = "\n\n".join(context_block_parts)[:120000]

    template_hints_parts: list[str] = []
    chosen_templates = templates
    if ws.active_template_asset_id:
        chosen_templates = [t for t in templates if t.id == ws.active_template_asset_id]
    for t in chosen_templates[:1]:
        if t.extracted_outline_json:
            try:
                obj = json.loads(t.extracted_outline_json)
                headings = obj.get("headings", [])
                template_hints_parts.append(f"{t.filename}: {', '.join(headings[:15])}")
            except Exception:
                template_hints_parts.append(f"{t.filename}: [outline parse error]")
    template_hints = "\n".join(template_hints_parts)

    sections, warnings = run_sow_chain(
        context_block=context_block,
        template_hints=template_hints,
        user_instructions=payload.additional_instructions or "",
    )

    assistant_message = Message(
        session_id=session.id,
        role="assistant",
        content=sections.full_markdown or sections.scope or "Generated SOW sections.",
    )
    db.add(assistant_message)
    db.commit()

    return GenerateOut(sections=sections, warnings=warnings)

