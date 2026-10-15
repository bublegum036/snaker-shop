from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import User
from app.core.security import DUMMY_HASH, hash_password, verify_password


def unauthorized():
    return HTTPException(401, 'Invalid credentials', headers={'WWW-Authenticate':'Bearer'})

def register(db, body):
    if db.scalar(select(User).where(User.email == str(body.email))) is not None:
        raise HTTPException(409, 'Email already registered')
    user = User(email=str(body.email), hashed_password=hash_password(body.password), is_admin=False)
    db.add(user)
    try:
        db.flush()
    except IntegrityError as error:
        if getattr(error.orig,'sqlstate',None) == '23505':
            raise HTTPException(409, 'Email already registered') from None
        raise
    return user

def authenticate(db, body):
    user = db.scalar(select(User).where(User.email == str(body.email)))
    valid = verify_password(body.password, user.hashed_password if user else DUMMY_HASH)
    if user is None or not valid:
        raise unauthorized()
    return user
