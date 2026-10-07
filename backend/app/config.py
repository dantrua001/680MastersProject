import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cooperative_scrabble.db")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "72"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")]
