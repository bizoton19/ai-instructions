from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth_crypto import hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import LoginIn, UserOut
from app.deps import get_current_user
from app.session_cookie import clear_session_cookie, set_session_cookie

router = APIRouter(prefix="/auth", tags=["auth"])


def _bootstrap_dev_user(db: Session) -> User:
    user = db.query(User).filter(User.email == settings.dev_login_email).first()
    if user:
        return user
    hash_hex, salt_hex = hash_password(settings.dev_login_password)
    user = User(email=settings.dev_login_email, hashed_password=f"{salt_hex}${hash_hex}")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        user = _bootstrap_dev_user(db)

    if not user.hashed_password or "$" not in user.hashed_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is not ready")

    salt_hex, hash_hex = user.hashed_password.split("$", 1)
    if not verify_password(payload.password, salt_hex, hash_hex):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    set_session_cookie(response, str(user.id))
    return user


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user)):
    return user

