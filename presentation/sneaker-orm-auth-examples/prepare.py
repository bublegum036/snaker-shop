"""Create a local env once, isolated schema, run migrations and seed."""
import os
from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parent

def ensure_env():
    env_path = ROOT/'.env'
    if not env_path.exists():
        content = (ROOT/'.env.example').read_text().replace('GENERATE_WITH_PREPARE_PY', secrets.token_urlsafe(48))
        fd = os.open(env_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write(content)

if __name__ == '__main__':
    ensure_env()
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text
    from database import make_engine
    from seed import seed
    engine = make_engine()
    with engine.begin() as conn:
        schema = conn.scalar(text('SHOW search_path'))
        # schema has been validated by make_engine.
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
    config = Config(str(ROOT/'alembic.ini'))
    with engine.connect() as conn:
        config.attributes['connection'] = conn
        command.upgrade(config, 'head')
    seed(engine)
    engine.dispose()
    print('Prepared isolated lesson schema. Run: python -m uvicorn run:app --host 127.0.0.1 --port 8007')
