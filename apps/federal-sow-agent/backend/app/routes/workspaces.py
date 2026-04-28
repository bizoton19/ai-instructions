from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Workspace
from app.schemas import WorkspaceCreate, WorkspaceOut

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Workspace).filter(Workspace.owner_user_id == user.id).order_by(Workspace.created_at.desc()).all()


@router.post("", response_model=WorkspaceOut)
def create_workspace(payload: WorkspaceCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = Workspace(name=payload.name.strip(), owner_user_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(workspace_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.owner_user_id == user.id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws

