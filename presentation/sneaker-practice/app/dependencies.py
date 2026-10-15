from typing import Annotated
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from app.database import SessionLocal
from app.models import User
from app.schemas.auth import UserRead
from app.core.security import decode_token
from app.services.auth import unauthorized

bearer = HTTPBearer(auto_error=False)

def get_current_user(request: Request,
                     credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
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
    # Materialize a safe snapshot and return the connection before business work.
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if user is None:
            raise unauthorized()
        return UserRead.model_validate(user)

def require_admin(user: Annotated[UserRead, Depends(get_current_user)]):
    if not user.is_admin:
        raise HTTPException(403, 'Admin access required')
    return user
