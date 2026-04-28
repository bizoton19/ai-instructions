from __future__ import annotations

import uuid
from pathlib import Path

from app.config import settings


def ensure_storage_dirs() -> None:
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    (settings.upload_dir / "templates").mkdir(parents=True, exist_ok=True)
    (settings.upload_dir / "context").mkdir(parents=True, exist_ok=True)
    (settings.upload_dir / "outputs").mkdir(parents=True, exist_ok=True)


def save_upload_bytes(kind: str, filename: str, data: bytes) -> tuple[str, Path]:
    ensure_storage_dirs()
    ext = Path(filename).suffix.lower()
    key = f"{kind}/{uuid.uuid4().hex}{ext}"
    path = settings.upload_dir / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key, path


def resolve_storage_key(storage_key: str) -> Path:
    return settings.upload_dir / storage_key

