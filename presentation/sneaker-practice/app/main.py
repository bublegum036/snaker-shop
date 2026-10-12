from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, TimeoutError
from app.database import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    engine.dispose()

app = FastAPI(title="Sneaker Shop · M0–M1", lifespan=lifespan)

@app.get("/health", responses={503: {"description": "Database unavailable"}})
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except (OperationalError, TimeoutError):
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ok"}
