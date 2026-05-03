from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.agent.sow_chain import run_sow_chain
from app.agents_config import get_agent_profile
from app.context_builder import build_generation_inputs
from app.database import get_db
from app.models import AgentSession, Message
from app.schemas import GenerateIn, GenerateOut
from app.workspace_access import must_workspace_exist

router = APIRouter(prefix="/workspaces/{workspace_id}/sessions/{session_id}", tags=["generate"])


@router.post("/generate", response_model=GenerateOut)
def generate_sow(
    workspace_id: str,
    session_id: str,
    payload: GenerateIn,
    db: Session = Depends(get_db),
):
    ws = must_workspace_exist(db, workspace_id)
    session = db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    context_block, template_hints = build_generation_inputs(db, workspace_id)

    agent_profile = get_agent_profile(session.agent_type)

    sections, warnings = run_sow_chain(
        context_block=context_block,
        template_hints=template_hints,
        user_instructions=payload.additional_instructions or "",
        system_prompt=agent_profile.system_prompt,
        temperature=float(ws.agent_temperature),
        workspace_instructions=ws.agent_workspace_instructions,
        run_tags=["federal-sow-generate", session.agent_type],
    )

    assistant_message = Message(
        session_id=session.id,
        role="assistant",
        content=sections.full_markdown
        or sections.scope
        or sections.deliverables
        or "Generated draft sections (see structured fields returned to the UI).",
    )
    db.add(assistant_message)
    db.commit()

    return GenerateOut(sections=sections, warnings=warnings)

