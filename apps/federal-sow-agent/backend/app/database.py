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
            sess_cols = conn.execute(text("PRAGMA table_info(agent_sessions)")).fetchall()
            sess_names = {c[1] for c in sess_cols}
            if "agent_type" not in sess_names:
                conn.execute(text("ALTER TABLE agent_sessions ADD COLUMN agent_type VARCHAR(64) DEFAULT 'sow_writer' NOT NULL"))
