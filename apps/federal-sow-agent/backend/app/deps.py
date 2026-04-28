from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.session_cookie import require_user_id


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> User:
    try:
        uid = UUID(user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user") from e
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
