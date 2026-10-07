import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models, realtime, words  # noqa: F401  (models must be imported so tables are created)
from .config import CORS_ORIGINS
from .database import Base, engine as db_engine
from .routers import auth, games

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(db_engine)
    words.load()
    yield


app = FastAPI(title="Cooperative Scrabble", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(games.router)
app.include_router(realtime.router)


@app.get("/api/health")
def health():
    return {"ok": True, **words.status()}
