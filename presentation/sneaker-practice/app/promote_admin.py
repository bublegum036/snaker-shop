"""Local operator command: promote an explicitly chosen existing account."""
import argparse
from sqlalchemy import select
from app.database import SessionLocal, engine
from app.models import User


def promote(email):
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None:
            raise SystemExit('Account not found. Register this account first.')
        user.is_admin = True
    print('Selected existing account is now an administrator.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('email', help='Exact email of the account to promote')
    args = parser.parse_args()
    try:
        promote(args.email)
    finally:
        engine.dispose()
