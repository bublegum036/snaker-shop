"""Disposable real backend for Playwright. Never serves the working database."""
import os
from pathlib import Path
import sys
from uuid import UUID, uuid4
import secrets
import signal
import logging

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

BACKEND = Path(__file__).resolve().parents[2] / "presentation" / "sneaker-practice"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)
run_id = str(UUID(os.environ["E2E_RUN_ID"]))
load_dotenv(BACKEND / ".env", override=False)
source = make_url(os.environ["DATABASE_URL"])
name = "sneaker_e2e_" + uuid4().hex
admin = create_engine(source.set(database="postgres"), isolation_level="AUTOCOMMIT",
                      connect_args={"connect_timeout": 3})
created = False
engine = None


def terminate(_signum, _frame):
    raise SystemExit(0)


signal.signal(signal.SIGTERM, terminate)
try:
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
        created = True
    # Set the target BEFORE importing app modules that create the global engine.
    os.environ["DATABASE_URL"] = source.set(database=name).render_as_string(hide_password=False)
    os.environ["JWT_SECRET"] = secrets.token_urlsafe(48)
    from alembic import command
    from alembic.config import Config
    from app.database import engine
    from app.seed import seed

    config = Config(str(BACKEND / "alembic.ini"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
    seed(engine)
    with engine.begin() as connection:
        # Tests buy the same fixture in several independent browser contexts.
        connection.execute(text("UPDATE product_sizes SET stock=100 WHERE id=101"))

    from app.final_main import app
    from app.core.request_logging import LOGGER_NAME
    import uvicorn

    logging.getLogger(LOGGER_NAME).setLevel(logging.WARNING)

    @app.get("/__e2e__/ready/" + run_id, include_in_schema=False)
    def ready():
        return {"run_id": run_id, "isolated": True}

    print("E2E: temporary database ready", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=18000, log_level="error", access_log=False)
finally:
    if engine is not None:
        engine.dispose()
    if created:
        # Only the random database CREATED by this process can reach DROP.
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        print("E2E: temporary database removed", flush=True)
    admin.dispose()
