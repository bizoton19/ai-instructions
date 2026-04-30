from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Workspace
from app.schemas import WorkspaceAgentSettingsPatch, WorkspaceCreate, WorkspaceOut
from app.workspace_access import must_workspace_owned, resolve_effective_owner_id

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def utcnow():
    return datetime.now(timezone.utc)


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(request: Request, db: Session = Depends(get_db)):
    owner_id = resolve_effective_owner_id(db, request)
    return (
        db.query(Workspace)
        .filter(Workspace.owner_user_id == owner_id)
        .order_by(Workspace.created_at.desc())
        .all()
    )


@router.post("", response_model=WorkspaceOut)
def create_workspace(payload: WorkspaceCreate, request: Request, db: Session = Depends(get_db)):
    owner_id = resolve_effective_owner_id(db, request)
    item = Workspace(name=payload.name.strip(), owner_user_id=owner_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(workspace_id: str, request: Request, db: Session = Depends(get_db)):
    owner_id = resolve_effective_owner_id(db, request)
    return must_workspace_owned(db, workspace_id, owner_id)


@router.patch("/{workspace_id}/agent-settings", response_model=WorkspaceOut)
def patch_workspace_agent_settings(
    workspace_id: str,
    body: WorkspaceAgentSettingsPatch,
    request: Request,
    db: Session = Depends(get_db),
):
    owner_id = resolve_effective_owner_id(db, request)
    ws = must_workspace_owned(db, workspace_id, owner_id)
    data = body.model_dump(exclude_unset=True)
    if "agent_temperature" in data:
        ws.agent_temperature = float(data["agent_temperature"])
    if "agent_workspace_instructions" in data:
        ws.agent_workspace_instructions = data["agent_workspace_instructions"]
    ws.updated_at = utcnow()
    db.commit()
    db.refresh(ws)
    return ws
