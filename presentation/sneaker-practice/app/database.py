from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import database_url

def make_engine(url=None):
    return create_engine(
        url or database_url(), pool_pre_ping=True, pool_timeout=3,
        connect_args={"connect_timeout": 3, "options": "-c statement_timeout=3000"},
    )

engine = make_engine()
SessionLocal = sessionmaker(bind=engine)

def get_session():
    with SessionLocal() as session:
        yield session
