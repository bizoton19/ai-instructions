from __future__ import annotations

from datetime import datetime, timezone
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Workspace
from app.schemas import WorkspaceAgentSettingsPatch, WorkspaceCreate, WorkspaceOut
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
