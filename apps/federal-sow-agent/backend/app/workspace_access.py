"""Resolve the signed-in account (or bootstrap dev account) and enforce workspace ownership."""

from __future__ import annotations

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.models import User, Workspace
from app.session_cookie import get_session_user_id
from app.user_bootstrap import ensure_bootstrap_user


def resolve_effective_owner_id(db: Session, request: Request) -> str:
    uid = get_session_user_id(request)
    if uid:
        user = db.query(User).filter(User.id == uid).first()
        if user:
            return user.id
    return ensure_bootstrap_user(db).id


def must_workspace_owned(db: Session, workspace_id: str, owner_id: str) -> Workspace:
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    if ws.owner_user_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to access this workspace",
        )
    return ws
