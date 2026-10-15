from contextlib import contextmanager
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User

class ShopError(Exception):
    def __init__(self, status, reason):
        self.status, self.reason = status, reason

@contextmanager
def transaction(*, owner_id=None, sessions=None, session: Session | None = None):
    """Own a transaction, or join an explicitly supplied active unit of work.

    Joined calls never commit/rollback/close it; failures must escape to its owner.
    No savepoints: all composed actions succeed or roll back together.
    """
    if session is not None:
        if not session.in_transaction():
            raise ValueError("An active transaction is required")
        lock_owner(session, owner_id)
        yield session
        return
    sessions = sessions or SessionLocal
    try:
        with sessions.begin() as db:
            # This teaching protocol is defined for READ COMMITTED.
            db.execute(text('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'))
            db.execute(text("SET LOCAL lock_timeout = '3s'"))
            db.execute(text("SET LOCAL statement_timeout = '5s'"))
            lock_owner(db, owner_id)
            yield db
    except DBAPIError as error:
        # The context above has rolled back before the controlled response.
        if getattr(error.orig, 'sqlstate', None) in {'40P01','40001','55P03','57014'}:
            raise ShopError(409, 'concurrent_change_retry') from None
        raise


def lock_owner(db, owner_id):
    if owner_id is not None:
        owner = db.scalar(select(User.id).where(User.id == owner_id).with_for_update())
        if owner is None:
            raise ShopError(401, 'unknown_user')


def require_admin(db, admin_id):
    admin = db.scalar(select(User).where(User.id == admin_id).with_for_update(read=True))
    if admin is None:
        raise ShopError(401, 'unknown_user')
    if not admin.is_admin:
        raise ShopError(403, 'admin_required')
