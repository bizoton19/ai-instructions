from __future__ import annotations

import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.merge.docx_merge import merge_docx, sow_model_to_flat
from app.models import AgentSession, Message, TemplateAsset, Workspace
from app.schemas import MergeIn, SOWSectionsModel
from app.storage import resolve_storage_key

router = APIRouter(prefix="/workspaces/{workspace_id}/sessions/{session_id}", tags=["merge"])


def _must_workspace(db: Session, workspace_id: UUID, user_id: UUID) -> Workspace:
    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.owner_user_id == user_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws


@router.post("/merge")
def merge_sow_docx(
    workspace_id: UUID,
    session_id: UUID,
    payload: MergeIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _must_workspace(db, workspace_id, user.id)
    session = db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    template = db.query(TemplateAsset).filter(
        TemplateAsset.id == payload.template_asset_id,
        TemplateAsset.workspace_id == workspace_id,
    ).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    template_path = resolve_storage_key(template.storage_key)
    if not template_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template file missing")

    if payload.sections is not None:
        sections = payload.sections
    elif payload.use_latest_generation:
        latest = db.query(Message).filter(Message.session_id == session.id, Message.role == "assistant").order_by(Message.created_at.desc()).first()
        if not latest:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No generated SOW found")
        sections = SOWSectionsModel(full_markdown=latest.content)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sections required if not using latest generation")

    flat = sow_model_to_flat(sections)
    out_name = f"{uuid.uuid4().hex}_merged_{template.filename}"
    out_path = Path(template_path.parent.parent / "outputs" / out_name)
    _, note = merge_docx(template_path, flat, out_path)

    return {"download_path": f"/workspaces/{workspace_id}/sessions/{session_id}/downloads/{out_name}", "note": note}


@router.get("/downloads/{filename}")
def download_file(filename: str):
    base = Path(__file__).resolve().parent.parent.parent / "uploads" / "outputs"
    path = base / filename
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

