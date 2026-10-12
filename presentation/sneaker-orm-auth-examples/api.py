"""Small runnable lesson. Not the full store or a deployment template."""
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import make_sessions
from models import User, Order
from schemas import Credentials, UserRead, OrderRead, TokenRead
from security import hash_password, verify_password, create_token, decode_token


def make_app(engine, secret):
    if len(secret) < 32:
        raise ValueError('Set a randomly generated JWT_SECRET of at least 32 characters')
    app = FastAPI(title='Sneaker lesson: ORM and access')
    SessionLocal = make_sessions(engine)
    bearer = HTTPBearer(auto_error=False)
    dummy_hash = hash_password('dummy-user-check-only')

    def get_db():
        with SessionLocal() as session:
            yield session

    def unauthorized():
        return HTTPException(401, 'Invalid credentials', headers={'WWW-Authenticate': 'Bearer'})

    def get_current_user(auth: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
        if auth is None:
            raise unauthorized()
        try:
            claims = decode_token(auth.credentials, secret)
            sub = claims['sub']
            if not isinstance(sub, str) or not sub.isascii() or not sub.isdecimal():
                raise ValueError('Invalid subject')
            user_id = int(sub)
            if not 0 < user_id <= 2147483647:
                raise ValueError('Subject outside ID range')
        except (JWTError, ValueError, KeyError):
            raise unauthorized()
        user = db.get(User, user_id)
        if user is None:
            raise unauthorized()
        return user

    def require_admin(user: User = Depends(get_current_user)):
        if not user.is_admin:
            raise HTTPException(403, 'Admin access required')
        return user

    @app.post('/auth/register', status_code=201, response_model=UserRead)
    def register(body: Credentials, db: Session = Depends(get_db)):
        if db.scalar(select(User).where(User.email == str(body.email))):
            raise HTTPException(409, 'Email already registered')
        user = User(email=str(body.email), hashed_password=hash_password(body.password), is_admin=False)
        db.add(user)
        try:
            db.commit()
        except IntegrityError as error:
            db.rollback()
            if getattr(error.orig, 'sqlstate', None) == '23505':
                raise HTTPException(409, 'Email already registered') from None
            raise
        db.refresh(user)
        return user

    @app.post('/auth/login', response_model=TokenRead)
    def login(body: Credentials, db: Session = Depends(get_db)):
        user = db.scalar(select(User).where(User.email == str(body.email)))
        password_ok = verify_password(body.password, user.hashed_password if user else dummy_hash)
        if user is None or not password_ok:
            raise unauthorized()
        return TokenRead(access_token=create_token(user.id, secret))

    @app.get('/auth/me', response_model=UserRead)
    def me(user: User = Depends(get_current_user)):
        return user

    @app.get('/admin/check')
    def admin_check(user: User = Depends(require_admin)):
        return {'allowed': True, 'user_id': user.id}

    @app.get('/orders/{order_id}', response_model=OrderRead)
    def own_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        order = db.scalar(select(Order).where(Order.id == order_id, Order.user_id == user.id))
        if order is None:
            raise HTTPException(404, 'Order not found')
        return order

    # Expose dependencies for tests/reading without replacing real auth in tests.
    app.state.get_current_user = get_current_user
    return app
