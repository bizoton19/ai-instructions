"""Creates the default development user row when the database has no matching account."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.auth_crypto import hash_password
from app.config import settings
from app.models import User


def ensure_bootstrap_user(db: Session) -> User:
    user = db.query(User).filter(User.email == settings.dev_login_email).first()
    if user:
        return user
    hash_hex, salt_hex = hash_password(settings.dev_login_password)
    user = User(email=settings.dev_login_email, hashed_password=f"{salt_hex}${hash_hex}")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
