from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


def _engine_kwargs() -> dict:
    kwargs: dict = {"pool_pre_ping": True}
    if settings.database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return kwargs


settings.data_dir.mkdir(parents=True, exist_ok=True)
engine = create_engine(settings.database_url, **_engine_kwargs())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    # Lightweight schema evolution for local SQLite dev.
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            # workspaces table
            ws_cols = conn.execute(text("PRAGMA table_info(workspaces)")).fetchall()
            ws_names = {c[1] for c in ws_cols}
            if "active_template_asset_id" not in ws_names:
                conn.execute(text("ALTER TABLE workspaces ADD COLUMN active_template_asset_id VARCHAR(36)"))
            
            # agent_sessions table
            def _session_col_names() -> set[str]:
                r = conn.execute(text("PRAGMA table_info(agent_sessions)")).fetchall()
                return {c[1] for c in r}

            sess_names = _session_col_names()
            if "agent_type" not in sess_names:
                conn.execute(text("ALTER TABLE agent_sessions ADD COLUMN agent_type VARCHAR(64) DEFAULT 'sow_writer' NOT NULL"))
            for col_name, sql in (
                ("orchestration_mode", "ALTER TABLE agent_sessions ADD COLUMN orchestration_mode VARCHAR(32) DEFAULT 'manual_review' NOT NULL"),
                ("pipeline_step", "ALTER TABLE agent_sessions ADD COLUMN pipeline_step INTEGER DEFAULT 0 NOT NULL"),
                ("pipeline_paused", "ALTER TABLE agent_sessions ADD COLUMN pipeline_paused INTEGER DEFAULT 0 NOT NULL"),
                ("pipeline_completed", "ALTER TABLE agent_sessions ADD COLUMN pipeline_completed INTEGER DEFAULT 0 NOT NULL"),
                ("needs_user_clarification", "ALTER TABLE agent_sessions ADD COLUMN needs_user_clarification INTEGER DEFAULT 0 NOT NULL"),
                ("pipeline_artifact_count", "ALTER TABLE agent_sessions ADD COLUMN pipeline_artifact_count INTEGER DEFAULT 0 NOT NULL"),
            ):
                sess_names = _session_col_names()
                if col_name not in sess_names:
                    conn.execute(text(sql))
