import json
import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import engine
from ..database import get_db
from ..models import Game, GamePlayer, User
from ..realtime import manager, room_info
from ..security import current_user

router = APIRouter(prefix="/api/games", tags=["games"])
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"


class JoinIn(BaseModel):
    code: str


def _new_code(db):
    while True:
        code = "".join(random.choices(ALPHABET, k=5))
        if not db.query(Game).filter(Game.code == code).first():
            return code


def _member_game(db, code, user):
    game = db.query(Game).filter(Game.code == code.strip().upper()).first()
    if not game:
        raise HTTPException(404, "No game with that code.")
    if user.id not in {gp.user_id for gp in game.players}:
        raise HTTPException(403, "You're not in this game.")
    return game


@router.post("")
async def create_game(user: User = Depends(current_user), db: Session = Depends(get_db)):
    game = Game(code=_new_code(db), host_id=user.id, status="waiting")
    game.players.append(GamePlayer(user_id=user.id, seat=0))
    db.add(game)
    db.commit()
    db.refresh(game)
    return room_info(game)


@router.post("/join")
async def join_game(body: JoinIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.code == body.code.strip().upper()).first()
    if not game:
        raise HTTPException(404, "No game with that code.")
    ids = [gp.user_id for gp in game.players]
    if user.id not in ids:  # players already in the game can always re-enter
        if game.status != "waiting":
            raise HTTPException(400, "That game has already started.")
        if len(ids) >= engine.MAX_PLAYERS:
            raise HTTPException(400, "That game is full.")
        game.players.append(GamePlayer(user_id=user.id, seat=len(ids)))
        db.commit()
        db.refresh(game)
        await manager.push_room(game.code, room_info(game))
    return room_info(game)


@router.get("/mine")
def my_games(user: User = Depends(current_user), db: Session = Depends(get_db)):
    games = db.query(Game).join(GamePlayer).filter(GamePlayer.user_id == user.id).order_by(Game.updated_at.desc()).all()
    out = []
    for g in games:
        st = json.loads(g.state) if g.state else None
        item = {"code": g.code, "status": g.status, "players": [gp.user.username for gp in g.players],
                "updated_at": g.updated_at.isoformat() + "Z", "round": None, "my_score": None, "turn": None, "my_turn": False}
        if st:
            cur = st["players"][st["turn"]]
            item.update(round=st["round"], turn=cur["name"], my_turn=(g.status == "active" and cur["id"] == user.id),
                        my_score=next((p["score"] for p in st["players"] if p["id"] == user.id), None))
        out.append(item)
    return out


@router.get("/{code}")
def get_game(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return room_info(_member_game(db, code, user))


@router.post("/{code}/start")
async def start_game(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    game = _member_game(db, code, user)
    if game.host_id != user.id:
        raise HTTPException(403, "Only the host can start the game.")
    if game.status != "waiting":
        raise HTTPException(400, "This game has already started.")
    if len(game.players) < engine.MIN_PLAYERS:
        raise HTTPException(400, "You need at least 2 players to start.")
    state = engine.new_game([{"id": gp.user_id, "name": gp.user.username} for gp in game.players])
    game.state = json.dumps(state)
    game.status = "active"
    db.commit()
    await manager.push_room(game.code, room_info(game))
    await manager.push_state(game.code, state)
    return room_info(game)


@router.get("/{code}/result")
def game_result(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    game = _member_game(db, code, user)
    st = json.loads(game.state) if game.state else None
    if not st or st["status"] != "finished":
        raise HTTPException(400, "This game isn't finished yet.")
    return {"code": game.code, "players": sorted(st["final"], key=lambda p: -p["score"]), "winners": st["winners"],
            "reason": st["ended_reason"], "rounds": st["round"], "turns": st["turn_no"] - 1}
