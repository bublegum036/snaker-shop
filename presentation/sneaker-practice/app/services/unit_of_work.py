from contextlib import contextmanager
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from app.database import SessionLocal
from app.models import User

class ShopError(Exception):
    def __init__(self, status, reason):
        self.status, self.reason = status, reason

@contextmanager
def transaction(*, owner_id=None, sessions=None):
    # A NEW session: never begin() on the session already used by auth.
    sessions = sessions or SessionLocal
    try:
        with sessions.begin() as db:
            # This teaching protocol is defined for READ COMMITTED.
            db.execute(text('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'))
            db.execute(text("SET LOCAL lock_timeout = '3s'"))
            db.execute(text("SET LOCAL statement_timeout = '5s'"))
            if owner_id is not None:
                owner = db.scalar(select(User.id).where(User.id == owner_id).with_for_update())
                if owner is None:
                    raise ShopError(401, 'unknown_user')
            yield db
    except DBAPIError as error:
        # The context above has rolled back before the controlled response.
        if getattr(error.orig, 'sqlstate', None) in {'40P01','40001','55P03','57014'}:
            raise ShopError(409, 'concurrent_change_retry') from None
        raise
