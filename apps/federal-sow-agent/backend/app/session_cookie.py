from urllib.parse import quote

from fastapi import Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.config import settings


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.secret_key, salt="sow-user-session")


def sign_user_id(user_id: str) -> str:
    return _serializer().dumps({"uid": user_id})


def unsign_session_token(token: str, max_age: int | None = None) -> str:
    try:
        data = _serializer().loads(token, max_age=max_age)
        uid = data.get("uid")
        if not uid or not isinstance(uid, str):
            raise ValueError("missing uid")
        return uid
    except (BadSignature, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from e


def set_session_cookie(response: Response, user_id: str) -> None:
    token = sign_user_id(str(user_id))
    response.set_cookie(
        key=settings.session_cookie_name,
        value=quote(token, safe=""),
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.session_max_age_seconds,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.session_cookie_name, path="/")


def get_session_user_id(request: Request) -> str | None:
    raw = request.cookies.get(settings.session_cookie_name)
    if not raw:
        return None
    try:
        from urllib.parse import unquote

        token = unquote(raw)
        return unsign_session_token(token, max_age=settings.session_max_age_seconds)
    except HTTPException:
        return None


async def require_user_id(request: Request) -> str:
    uid = get_session_user_id(request)
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return uid


UserIdDep = Depends(require_user_id)
