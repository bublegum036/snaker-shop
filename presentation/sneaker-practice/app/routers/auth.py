from typing import Annotated
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_session
from app.dependencies import get_current_user
from app.schemas.auth import Credentials, UserRead, TokenRead
from app.services import auth
from app.services.unit_of_work import transaction
from app.core.security import create_token

router = APIRouter(prefix='/auth', tags=['Auth'])
Db = Annotated[Session, Depends(get_session)]

@router.post('/register', status_code=201, response_model=UserRead)
def register(body: Credentials):
    with transaction() as db:
        return UserRead.model_validate(auth.register(db, body))

@router.post('/login', response_model=TokenRead)
def login(body: Credentials, db: Db, request: Request):
    user = auth.authenticate(db, body)
    return TokenRead(access_token=create_token(user.id, request.app.state.jwt_secret))

@router.get('/me', response_model=UserRead)
def me(user: Annotated[UserRead, Depends(get_current_user)]):
    return user
