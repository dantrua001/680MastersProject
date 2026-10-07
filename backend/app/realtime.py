"""WebSocket layer: one socket per player per game. Every action is applied to the saved state and then
broadcast, so all players stay in sync and the game can be resumed at any time."""
import json

from fastapi import APIRouter, WebSocket
from starlette.websockets import WebSocketDisconnect

from . import engine
from .database import SessionLocal
from .models import Game
from .security import read_token

router = APIRouter()


def room_info(game):
    return {
        "code": game.code, "status": game.status, "host_id": game.host_id, "max": engine.MAX_PLAYERS,
        "players": [{"id": gp.user_id, "name": gp.user.username, "seat": gp.seat + 1} for gp in game.players],
    }


class Manager:
    def __init__(self):
        self.rooms = {}  # game code -> {websocket: user id}

    def add(self, code, ws, uid):
        self.rooms.setdefault(code, {})[ws] = uid

    def remove(self, code, ws):
        self.rooms.get(code, {}).pop(ws, None)

    async def _send(self, code, make):
        for ws, uid in list(self.rooms.get(code, {}).items()):
            try:
                await ws.send_json(make(uid))
            except Exception:
                self.remove(code, ws)

    async def push_room(self, code, room):
        await self._send(code, lambda uid: {"type": "room", "room": room})

    async def push_state(self, code, state):
        await self._send(code, lambda uid: {"type": "state", "state": engine.view_for(state, uid)})


manager = Manager()


def _dispatch(state, uid, msg):
    kind = msg.get("type")
    if kind == "submit":
        return engine.submit_move(state, uid, msg.get("placements"))
    if kind == "preview":
        return engine.preview_move(state, uid, msg.get("placements"))
    if kind == "pass":
        return engine.pass_turn(state, uid)
    if kind == "resign":
        return engine.resign(state, uid)
    if kind == "exchange":
        return engine.exchange(state, uid, msg.get("tiles"))
    if kind == "chat":
        return engine.add_chat(state, uid, msg.get("text", ""))
    if kind == "assist_suggest":
        return engine.suggest(state, uid, msg.get("word"), msg.get("row"), msg.get("col"), msg.get("direction"))
    if kind == "assist_respond":
        return engine.respond_assist(state, uid, bool(msg.get("accept")))
    if kind == "block":
        return engine.place_block(state, uid, msg.get("row"), msg.get("col"))
    if kind == "trade_propose":
        return engine.propose_trade(state, uid, msg.get("to"), msg.get("give"))
    if kind == "trade_respond":
        return engine.respond_trade(state, uid, bool(msg.get("accept")), msg.get("give"))
    if kind == "trade_cancel":
        return engine.cancel_trade(state, uid)
    raise engine.GameError("Unknown action.")


async def _handle(code, uid, ws, msg):
    if not isinstance(msg, dict):
        return
    kind = msg.get("type")
    with SessionLocal() as db:
        game = db.query(Game).filter(Game.code == code).first()
        if not game or not game.state:
            await ws.send_json({"type": "error", "message": "The game hasn't started yet."})
            return
        state = json.loads(game.state)
        try:
            result = _dispatch(state, uid, msg)
        except engine.GameError as exc:
            if kind == "preview":
                await ws.send_json({"type": "preview", "ok": False, "error": str(exc)})
            else:
                await ws.send_json({"type": "error", "message": str(exc)})
            return
        except (TypeError, ValueError, KeyError):
            await ws.send_json({"type": "error", "message": "That request wasn't valid."})
            return
        if kind == "preview":
            await ws.send_json({"type": "preview", **result})
            return
        game.state = json.dumps(state)
        if state["status"] == "finished":
            game.status = "finished"
        db.commit()  # saved after every action
    if kind == "assist_respond" and result:
        await ws.send_json({"type": "placements", "placements": result})
    await manager.push_state(code, state)


@router.websocket("/ws/games/{code}")
async def game_socket(ws: WebSocket, code: str, token: str = ""):
    await ws.accept()
    code = code.upper()
    uid = read_token(token)
    if uid is None:
        await ws.close(code=4401)
        return
    with SessionLocal() as db:
        game = db.query(Game).filter(Game.code == code).first()
        if not game or uid not in {gp.user_id for gp in game.players}:
            await ws.close(code=4403)
            return
        room = room_info(game)
        state = json.loads(game.state) if game.state else None
    manager.add(code, ws, uid)
    try:
        await ws.send_json({"type": "room", "room": room})
        if state:
            await ws.send_json({"type": "state", "state": engine.view_for(state, uid)})
        while True:
            try:
                msg = await ws.receive_json()
            except (WebSocketDisconnect, RuntimeError):
                break
            except ValueError:  # not JSON: ignore
                continue
            await _handle(code, uid, ws, msg)
    finally:
        manager.remove(code, ws)
