from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth_crypto import verify_password
from app.database import get_db
from app.models import User
from app.schemas import LoginIn, UserOut
from app.session_cookie import clear_session_cookie, get_session_user_id, set_session_cookie
from app.user_bootstrap import ensure_bootstrap_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        user = ensure_bootstrap_user(db)

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


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    uid = get_session_user_id(request)
    if not uid:
        return {"authenticated": False}
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": UserOut.model_validate(user).model_dump()}

