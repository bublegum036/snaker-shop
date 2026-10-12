import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env", override=False)

def database_url() -> str:
    value = os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError("Set DATABASE_URL in .env or the environment")
    return value


def jwt_secret() -> str:
    value = os.getenv("JWT_SECRET", "")
    if len(value) < 32:
        raise RuntimeError("Set a random JWT_SECRET of at least 32 characters for M3")
    return value
