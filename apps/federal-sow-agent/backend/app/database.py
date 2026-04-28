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
            cols = conn.execute(text("PRAGMA table_info(workspaces)")).fetchall()
            names = {c[1] for c in cols}
            if "active_template_asset_id" not in names:
                conn.execute(text("ALTER TABLE workspaces ADD COLUMN active_template_asset_id VARCHAR(36)"))
