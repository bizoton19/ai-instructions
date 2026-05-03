"""Shared fixtures for backend tests."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app import models  # noqa: F401 — register ORM mappers
from app.database import Base
from app.models import AgentSession, User, Workspace


@pytest.fixture
def db_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        user = User(email="tester@example.gov", hashed_password="not-used")
        session.add(user)
        session.commit()
        session.refresh(user)

        ws = Workspace(name="Test workspace", owner_user_id=user.id)
        session.add(ws)
        session.commit()
        session.refresh(ws)

        agent_session = AgentSession(workspace_id=ws.id, title="Test session", orchestration_mode="automatic")
        session.add(agent_session)
        session.commit()
        session.refresh(agent_session)

        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def workspace_id(db_session: Session) -> str:
    ws = db_session.query(Workspace).first()
    assert ws is not None
    return ws.id


@pytest.fixture
def session_id(db_session: Session) -> str:
    s = db_session.query(AgentSession).first()
    assert s is not None
    return s.id
