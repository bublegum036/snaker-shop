from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext

ALGORITHM = 'HS256'
ISSUER = 'sneaker-lesson'
AUDIENCE = 'sneaker-api'
pwd_context = CryptContext(schemes=['bcrypt'], bcrypt__rounds=12, bcrypt__truncate_error=True)

def hash_password(password):
    return pwd_context.hash(password)

def verify_password(password, hashed):
    return pwd_context.verify(password, hashed)

def create_token(user_id, secret, expires=None):
    expires = expires or datetime.now(timezone.utc) + timedelta(minutes=15)
    return jwt.encode({'sub': str(user_id), 'exp': expires, 'iss': ISSUER, 'aud': AUDIENCE}, secret, algorithm=ALGORITHM)

def decode_token(token, secret):
    return jwt.decode(token, secret, algorithms=[ALGORITHM], issuer=ISSUER, audience=AUDIENCE,
                      options={'require_sub': True, 'require_exp': True, 'require_iss': True, 'require_aud': True})
