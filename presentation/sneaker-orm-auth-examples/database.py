import os
import re
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')

def make_engine(schema=None):
    schema = schema or os.getenv('LESSON_SCHEMA', 'lesson78_local')
    if not re.fullmatch(r'lesson78_[a-z0-9_]+', schema):
        raise ValueError('Use an isolated schema starting with lesson78_')
    url = os.environ['DATABASE_URL']
    return create_engine(url, pool_pre_ping=True, connect_args={'options': f'-c search_path={schema}', 'connect_timeout': 5})

def make_sessions(engine):
    return sessionmaker(engine)
