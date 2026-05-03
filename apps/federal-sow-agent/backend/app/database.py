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
            if "agent_temperature" not in ws_names:
                conn.execute(text("ALTER TABLE workspaces ADD COLUMN agent_temperature REAL NOT NULL DEFAULT 0.2"))
            if "agent_workspace_instructions" not in ws_names:
                conn.execute(text("ALTER TABLE workspaces ADD COLUMN agent_workspace_instructions TEXT"))

            # Reassign workspaces whose owner id is not a valid user (e.g. legacy "local-user" string).
            first_user = conn.execute(text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")).fetchone()
            if first_user:
                conn.execute(
                    text(
                        "UPDATE workspaces SET owner_user_id = :uid "
                        "WHERE owner_user_id NOT IN (SELECT id FROM users)"
                    ),
                    {"uid": str(first_user[0])},
                )
            
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

            # pipeline_artifacts table (new table for phase-specific artifacts)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS pipeline_artifacts (
                    id VARCHAR(36) PRIMARY KEY,
                    session_id VARCHAR(36) NOT NULL,
                    workspace_id VARCHAR(36) NOT NULL,
                    phase_order INTEGER NOT NULL,
                    agent_id VARCHAR(64) NOT NULL,
                    agent_name VARCHAR(255) NOT NULL,
                    artifact_type VARCHAR(64) NOT NULL,
                    artifact_filename VARCHAR(255) NOT NULL,
                    artifact_description VARCHAR(512) NOT NULL,
                    structured_data_json TEXT NOT NULL,
                    full_markdown TEXT NOT NULL,
                    content_summary TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
                    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
                )
            """))
            # Create indexes for pipeline_artifacts
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_artifacts_session ON pipeline_artifacts(session_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_artifacts_workspace ON pipeline_artifacts(workspace_id)
            """))
