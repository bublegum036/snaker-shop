from typing import Annotated
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session
from app.database import get_session
from app.models import User
from app.core.security import decode_token
from app.services.auth import unauthorized

bearer = HTTPBearer(auto_error=False)

def get_current_user(request: Request,
                     credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
                     db: Annotated[Session, Depends(get_session)]):
    if credentials is None:
        raise unauthorized()
    try:
        claims = decode_token(credentials.credentials, request.app.state.jwt_secret)
        sub = claims['sub']
        if not isinstance(sub, str) or not sub.isascii() or not sub.isdecimal():
            raise ValueError('Invalid sub')
        user_id = int(sub)
        if not 0 < user_id <= 2147483647:
            raise ValueError('ID out of range')
    except (JWTError, ValueError, KeyError):
        raise unauthorized()
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized()
    return user

def require_admin(user: Annotated[User, Depends(get_current_user)]):
    if not user.is_admin:
        raise HTTPException(403, 'Admin access required')
    return user
