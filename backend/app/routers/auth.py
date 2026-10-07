import random
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..security import current_user, hash_password, make_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
NAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")


class Creds(BaseModel):
    username: str
    password: str


class GuestIn(BaseModel):
    name: Optional[str] = None


def _user(u):
    return {"id": u.id, "username": u.username, "is_guest": bool(u.is_guest)}


def _session(u):
    return {"token": make_token(u.id), "user": _user(u)}


def _find(db, name):
    return db.query(User).filter(func.lower(User.username) == name.lower()).first()


@router.post("/signup")
def signup(body: Creds, db: Session = Depends(get_db)):
    name = body.username.strip()
    if not NAME_RE.match(name):
        raise HTTPException(400, "Username must be 3-20 letters, numbers or underscores.")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    if _find(db, name):
        raise HTTPException(409, "That username is taken.")
    user = User(username=name, password_hash=hash_password(body.password), is_guest=False)
    db.add(user)
    db.commit()
    return _session(user)


@router.post("/login")
def login(body: Creds, db: Session = Depends(get_db)):
    user = _find(db, body.username.strip())
    if not user or user.is_guest or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong username or password.")
    return _session(user)


@router.post("/guest")
def guest(body: GuestIn, db: Session = Depends(get_db)):
    base = re.sub(r"[^A-Za-z0-9_]", "", body.name or "")[:14] or "Guest"
    while True:
        name = "%s%d" % (base, random.randint(100, 9999))
        if not _find(db, name):
            break
    user = User(username=name, is_guest=True)
    db.add(user)
    db.commit()
    return _session(user)


@router.get("/me")
def me(user: User = Depends(current_user)):
    return _user(user)
