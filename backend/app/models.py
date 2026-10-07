from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(40), unique=True, nullable=False, index=True)
    password_hash = Column(String(200))  # empty for guests
    is_guest = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


class Game(Base):
    __tablename__ = "games"
    id = Column(Integer, primary_key=True)
    code = Column(String(8), unique=True, nullable=False, index=True)
    host_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(12), default="waiting")  # waiting | active | finished
    state = Column(Text)  # full game state as JSON; saved after every action, so games resume
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)
    players = relationship("GamePlayer", back_populates="game", order_by="GamePlayer.seat", cascade="all, delete-orphan")


class GamePlayer(Base):
    __tablename__ = "game_players"
    __table_args__ = (UniqueConstraint("game_id", "user_id"),)
    id = Column(Integer, primary_key=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seat = Column(Integer, nullable=False)
    game = relationship("Game", back_populates="players")
    user = relationship("User")
