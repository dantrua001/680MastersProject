import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import SECRET_KEY, TOKEN_HOURS
from .database import get_db
from .models import User


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return salt.hex() + "$" + digest.hex()


def verify_password(password: str, stored: Optional[str]) -> bool:
    try:
        salt_hex, digest_hex = (stored or "").split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 200_000)
    except ValueError:
        return False
    return hmac.compare_digest(digest.hex(), digest_hex)


def _sign(payload: str) -> str:
    return hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


def make_token(user_id: int) -> str:
    body = json.dumps({"uid": user_id, "exp": int(time.time()) + TOKEN_HOURS * 3600}).encode()
    payload = base64.urlsafe_b64encode(body).decode().rstrip("=")
    return payload + "." + _sign(payload)


def read_token(token: str) -> Optional[int]:
    try:
        payload, sig = token.split(".")
        if not hmac.compare_digest(sig, _sign(payload)):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return data["uid"] if data["exp"] > time.time() else None
    except Exception:
        return None


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    uid = read_token(authorization.removeprefix("Bearer ").strip())
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Please sign in again.")
    return user
