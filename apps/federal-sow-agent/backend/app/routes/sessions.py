from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.agents_config import AGENTS
from app.database import get_db
from app.models import AgentSession, Message, Workspace
from app.schemas import AgentSessionOut, MessageCreate, MessageOut, SessionCreate, SessionUpdate


def utcnow():
    return datetime.now(timezone.utc)

router = APIRouter(prefix="/workspaces/{workspace_id}/sessions", tags=["sessions"])


def _must_workspace(db: Session, workspace_id: str) -> Workspace:
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws


@router.get("", response_model=list[AgentSessionOut])
def list_sessions(workspace_id: str, db: Session = Depends(get_db)):
    _must_workspace(db, workspace_id)
    return db.query(AgentSession).filter(AgentSession.workspace_id == workspace_id).order_by(AgentSession.created_at.desc()).all()


@router.post("", response_model=AgentSessionOut)
def create_session(workspace_id: str, payload: SessionCreate, db: Session = Depends(get_db)):
    _must_workspace(db, workspace_id)
    agent_type = (payload.agent_type or "sow_writer").strip()
    if agent_type not in AGENTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown agent_type")
    item = AgentSession(
        workspace_id=workspace_id,
        title=(payload.title or "New session").strip(),
        agent_type=agent_type,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{session_id}", response_model=AgentSessionOut)
def update_session(workspace_id: str, session_id: str, payload: SessionUpdate, db: Session = Depends(get_db)):
    _must_workspace(db, workspace_id)
    session = (
        db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if payload.title is not None:
        stripped = payload.title.strip()
        if stripped:
            session.title = stripped
    if payload.agent_type is not None:
        tid = payload.agent_type.strip()
        if tid not in AGENTS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown agent_type")
        session.agent_type = tid
    if payload.orchestration_mode is not None:
        orch = payload.orchestration_mode.strip()
        if orch not in ("manual_review", "automatic"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="orchestration_mode must be manual_review or automatic",
            )
        session.orchestration_mode = orch
    session.updated_at = utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}/messages", response_model=list[MessageOut])
def list_messages(workspace_id: str, session_id: str, db: Session = Depends(get_db)):
    _must_workspace(db, workspace_id)
    session = db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return db.query(Message).filter(Message.session_id == session.id).order_by(Message.created_at.asc()).all()


@router.post("/{session_id}/messages", response_model=MessageOut)
def add_message(
    workspace_id: str,
    session_id: str,
    payload: MessageCreate,
    db: Session = Depends(get_db),
):
    _must_workspace(db, workspace_id)
    session = db.query(AgentSession).filter(AgentSession.id == session_id, AgentSession.workspace_id == workspace_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    msg = Message(session_id=session.id, role="user", content=payload.content.strip())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

