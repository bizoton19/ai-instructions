from __future__ import annotations

from datetime import datetime, timezone
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.merge.pipeline_phase_export import delete_merged_docx_file
from app.models import AgentSession, ContextAsset, Message, PipelineArtifact, TemplateAsset, Workspace
from app.schemas import WorkspaceAgentSettingsPatch, WorkspaceCreate, WorkspaceOut, WorkspacePatch
from app.storage import resolve_storage_key
from app.user_bootstrap import ensure_bootstrap_user

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def utcnow():
    return datetime.now(timezone.utc)


def _parse_specialist_template_map(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}
    try:
        obj = json.loads(raw)
    except Exception:
        return {}
    if not isinstance(obj, dict):
        return {}
    clean: dict[str, str] = {}
    for k, v in obj.items():
        if isinstance(k, str) and isinstance(v, str) and k.strip() and v.strip():
            clean[k.strip()] = v.strip()
    return clean


def _workspace_out(ws: Workspace) -> WorkspaceOut:
    return WorkspaceOut(
        id=ws.id,
        name=ws.name,
        owner_user_id=ws.owner_user_id,
        active_template_asset_id=ws.active_template_asset_id,
        specialist_template_map=_parse_specialist_template_map(ws.specialist_template_map_json),
        agent_temperature=float(ws.agent_temperature),
        agent_workspace_instructions=ws.agent_workspace_instructions,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db)):
    items = db.query(Workspace).order_by(Workspace.created_at.desc()).all()
    return [_workspace_out(x) for x in items]


@router.post("", response_model=WorkspaceOut)
def create_workspace(payload: WorkspaceCreate, db: Session = Depends(get_db)):
    owner = ensure_bootstrap_user(db)
    item = Workspace(name=payload.name.strip(), owner_user_id=owner.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _workspace_out(item)


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return _workspace_out(ws)


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
def patch_workspace(workspace_id: str, body: WorkspacePatch, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    ws.name = body.name.strip()
    ws.updated_at = utcnow()
    db.commit()
    db.refresh(ws)
    return _workspace_out(ws)


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: str, db: Session = Depends(get_db)):
    """Remove workspace and all sessions, messages, pipeline artifacts, uploads, and related export files."""
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    sessions = db.query(AgentSession).filter(AgentSession.workspace_id == workspace_id).all()
    session_ids = [s.id for s in sessions]
    id_prefixes = {sid[:8] for sid in session_ids}

    for art in db.query(PipelineArtifact).filter(PipelineArtifact.workspace_id == workspace_id).all():
        delete_merged_docx_file(art.exported_docx_key)
    db.query(PipelineArtifact).filter(PipelineArtifact.workspace_id == workspace_id).delete(synchronize_session=False)
    for sid in session_ids:
        db.query(Message).filter(Message.session_id == sid).delete(synchronize_session=False)
    db.query(AgentSession).filter(AgentSession.workspace_id == workspace_id).delete(synchronize_session=False)

    for c in db.query(ContextAsset).filter(ContextAsset.workspace_id == workspace_id).all():
        path = resolve_storage_key(c.storage_key)
        if path.is_file():
            path.unlink(missing_ok=True)
        db.delete(c)

    for t in db.query(TemplateAsset).filter(TemplateAsset.workspace_id == workspace_id).all():
        path = resolve_storage_key(t.storage_key)
        if path.is_file():
            path.unlink(missing_ok=True)
        db.delete(t)

    out_dir = settings.upload_dir / "outputs"
    if out_dir.is_dir():
        for f in out_dir.iterdir():
            if not f.is_file():
                continue
            if any(pref in f.name for pref in id_prefixes):
                f.unlink(missing_ok=True)

    db.delete(ws)
    db.commit()
    return {"ok": True}


@router.patch("/{workspace_id}/agent-settings", response_model=WorkspaceOut)
def patch_workspace_agent_settings(
    workspace_id: str,
    body: WorkspaceAgentSettingsPatch,
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    data = body.model_dump(exclude_unset=True)
    if "agent_temperature" in data:
        ws.agent_temperature = float(data["agent_temperature"])
    if "agent_workspace_instructions" in data:
        ws.agent_workspace_instructions = data["agent_workspace_instructions"]
    if "specialist_template_map" in data:
        mapping = data["specialist_template_map"] or {}
        clean: dict[str, str] = {}
        for k, v in mapping.items():
            if isinstance(k, str) and isinstance(v, str) and k.strip() and v.strip():
                clean[k.strip()] = v.strip()
        ws.specialist_template_map_json = json.dumps(clean) if clean else None
    ws.updated_at = utcnow()
    db.commit()
    db.refresh(ws)
    return _workspace_out(ws)
