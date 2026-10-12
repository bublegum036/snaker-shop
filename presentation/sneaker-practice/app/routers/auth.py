from typing import Annotated
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import get_current_user
from app.models import User
from app.schemas.auth import Credentials, UserRead, TokenRead
from app.services import auth
from app.core.security import create_token

router = APIRouter(prefix='/auth', tags=['Auth'])
Db = Annotated[Session, Depends(get_session)]

@router.post('/register', status_code=201, response_model=UserRead)
def register(body: Credentials, db: Db):
    return auth.register(db, body)

@router.post('/login', response_model=TokenRead)
def login(body: Credentials, db: Db, request: Request):
    user = auth.authenticate(db, body)
    return TokenRead(access_token=create_token(user.id, request.app.state.jwt_secret))

@router.get('/me', response_model=UserRead)
def me(user: Annotated[User, Depends(get_current_user)]):
    return user
