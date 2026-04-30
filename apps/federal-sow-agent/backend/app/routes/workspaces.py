from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Workspace
from app.schemas import WorkspaceAgentSettingsPatch, WorkspaceCreate, WorkspaceOut
from app.user_bootstrap import ensure_bootstrap_user

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def utcnow():
    return datetime.now(timezone.utc)


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db)):
    return db.query(Workspace).order_by(Workspace.created_at.desc()).all()


@router.post("", response_model=WorkspaceOut)
def create_workspace(payload: WorkspaceCreate, db: Session = Depends(get_db)):
    owner = ensure_bootstrap_user(db)
    item = Workspace(name=payload.name.strip(), owner_user_id=owner.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws


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
    ws.updated_at = utcnow()
    db.commit()
    db.refresh(ws)
    return ws
