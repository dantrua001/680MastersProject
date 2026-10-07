"""Scrabble rules engine plus the three interaction rules (Assist, Block, Trade).

Pure Python with no web or database imports, so it can be tested on its own.
A game is one JSON-serialisable dict. Player ids are ints; dict keys are strings.
"""
import random
import time
import uuid

from . import words

SIZE, CENTER, RACK_SIZE, BINGO_BONUS = 15, 7, 7, 50
MIN_PLAYERS, MAX_PLAYERS = 2, 4

DIST = {"A": 9, "B": 2, "C": 2, "D": 4, "E": 12, "F": 2, "G": 3, "H": 2, "I": 9, "J": 1, "K": 1, "L": 4, "M": 2,
        "N": 6, "O": 8, "P": 2, "Q": 1, "R": 6, "S": 4, "T": 6, "U": 4, "V": 2, "W": 2, "X": 1, "Y": 2, "Z": 1, "?": 2}
VALUES = {"?": 0}
for _pts, _letters in ((1, "AEILNORSTU"), (2, "DG"), (3, "BCMP"), (4, "FHVWY"), (5, "K"), (8, "JX"), (10, "QZ")):
    for _ch in _letters:
        VALUES[_ch] = _pts

# One quarter of the board; the rest is mirrored.
_QUARTER = {
    "TW": [(0, 0), (0, 7), (7, 0)],
    "DW": [(1, 1), (2, 2), (3, 3), (4, 4), (7, 7)],
    "TL": [(1, 5), (5, 1), (5, 5)],
    "DL": [(0, 3), (2, 6), (3, 0), (3, 7), (6, 2), (6, 6), (7, 3)],
}
PREMIUM = {}
for _kind, _cells in _QUARTER.items():
    for _r, _c in _cells:
        for _pos in {(_r, _c), (_r, 14 - _c), (14 - _r, _c), (14 - _r, 14 - _c)}:
            PREMIUM[_pos] = _kind


class GameError(Exception):
    """A rule was broken. The message is shown to the player."""


# ---------------------------------------------------------------- setup

def new_game(players):
    bag = [ch for ch, n in DIST.items() for _ in range(n)]
    random.shuffle(bag)
    state = {
        "board": [[None] * SIZE for _ in range(SIZE)],
        "bag": bag,
        "racks": {},
        "players": [{"id": p["id"], "name": p["name"], "score": 0} for p in players],
        "turn": 0, "turn_no": 1, "round": 1, "round_turns": [], "passes": 0,
        "status": "active", "resigned": [],
        "block": None, "block_used": {}, "trade_used": {},
        "assist_used": False, "suggestion": None, "trade": None,
        "last_move": None, "log": [], "chat": [],
        "winners": [], "final": [], "ended_reason": "",
    }
    for p in players:
        state["racks"][str(p["id"])] = []
        _draw(state, p["id"])
    _log(state, "Game started. %s goes first." % players[0]["name"])
    return state


VOWELS = set("AEIOU")


def view_for(state, pid):
    """What one player is allowed to see: their own rack, and the bag's size and letter mix, but never
    the exact remaining letters (that would let a player count what opponents are likely to draw)."""
    view = {k: v for k, v in state.items() if k not in ("bag", "racks")}
    view["rack"] = state["racks"].get(str(pid), [])
    view["rack_counts"] = {k: len(r) for k, r in state["racks"].items()}
    view["bag_count"] = len(state["bag"])
    view["bag_vowels"] = sum(1 for t in state["bag"] if t in VOWELS)
    view["bag_consonants"] = sum(1 for t in state["bag"] if t.isalpha() and t not in VOWELS)
    return view


# ---------------------------------------------------------------- helpers

def _log(state, message, pid=None, tiles=None, score=None):
    """Every log entry is structured so the UI can show it as a turn card (player, tiles, score, time),
    the way the reference game's Turn History does. `message` is kept as a plain-text fallback."""
    state["log"].append({"t": int(time.time()), "pid": pid, "message": message, "tiles": tiles, "score": score})
    del state["log"][:-60]


def _player(state, pid):
    for p in state["players"]:
        if p["id"] == pid:
            return p
    raise GameError("You're not in this game.")


def _require_active(state):
    if state["status"] != "active":
        raise GameError("This game is over.")


def _require_turn(state, pid):
    _require_active(state)
    _player(state, pid)
    if pid in state.get("resigned", ()):
        raise GameError("You've resigned from this game.")
    if state["players"][state["turn"]]["id"] != pid:
        raise GameError("It's not your turn.")


def _draw(state, pid):
    rack = state["racks"][str(pid)]
    while len(rack) < RACK_SIZE and state["bag"]:
        rack.append(state["bag"].pop())


def _active(state):
    resigned = set(state.get("resigned", ()))
    return [p for p in state["players"] if p["id"] not in resigned]


def _advance(state, start):
    """Next seat after `start`, skipping anyone who has resigned."""
    n = len(state["players"])
    idx = start
    for _ in range(n):
        idx = (idx + 1) % n
        if state["players"][idx]["id"] not in state.get("resigned", ()):
            return idx
    return (start + 1) % n


def _next_player(state):
    return state["players"][_advance(state, state["turn"])]


def _block_pos(state, pid):
    b = state["block"]
    return (b["row"], b["col"]) if b and b["target"] == pid else None


def _end_turn(state, pid):
    state["suggestion"] = None
    state["assist_used"] = False
    if state["block"] and state["block"]["target"] == pid:
        state["block"] = None
    if pid not in state["round_turns"]:
        state["round_turns"].append(pid)
    if len(state["round_turns"]) >= len(_active(state)):
        state["round"] += 1
        state["round_turns"] = []
    state["turn"] = _advance(state, state["turn"])
    state["turn_no"] += 1


def _finish(state, went_out, reason):
    state["status"] = "finished"
    left = {p["id"]: sum(VALUES[t] for t in state["racks"][str(p["id"])]) for p in state["players"]}
    final = []
    for p in state["players"]:
        base = p["score"]
        bonus = sum(v for k, v in left.items() if k != went_out) if p["id"] == went_out else 0
        p["score"] = base + bonus - left[p["id"]]
        final.append({"id": p["id"], "name": p["name"], "base": base, "leftover": left[p["id"]], "bonus": bonus, "score": p["score"]})
    top = max(p["score"] for p in state["players"])
    state["winners"] = [p["id"] for p in state["players"] if p["score"] == top]
    state["final"] = final
    state["ended_reason"] = reason
    _log(state, "Game over. " + reason)


def _scoreless(state, pid, message):
    state["passes"] += 1
    _log(state, message, pid=pid)
    if state["passes"] >= 2 * len(_active(state)):
        _finish(state, None, "Every player passed twice in a row.")
    else:
        _end_turn(state, pid)


# ---------------------------------------------------------------- moves

def _parse(raw):
    if not isinstance(raw, list) or not raw:
        raise GameError("Place at least one tile.")
    out = []
    for p in raw:
        try:
            r, c = int(p["row"]), int(p["col"])
        except (KeyError, TypeError, ValueError):
            raise GameError("Invalid tile position.")
        letter = str(p.get("letter", "")).upper()
        if len(letter) != 1 or not letter.isalpha() or not letter.isascii():
            raise GameError("Invalid letter.")
        out.append({"row": r, "col": c, "letter": letter, "blank": bool(p.get("blank"))})
    return out


def _take_from_rack(rack, placements):
    rack = list(rack)
    for p in placements:
        tile = "?" if p["blank"] else p["letter"]
        if tile not in rack:
            raise GameError("You don't have the %s tile." % ("blank" if tile == "?" else tile))
        rack.remove(tile)
    return rack


def _score_word(text, cells, block_pos):
    total, mult, blocked = 0, 1, False
    for r, c, letter, blank, is_new in cells:
        value = 0 if blank else VALUES[letter]
        if is_new:  # premium squares only count for tiles placed this turn
            kind = PREMIUM.get((r, c))
            if kind == "DL":
                value *= 2
            elif kind == "TL":
                value *= 3
            elif kind == "DW":
                mult *= 2
            elif kind == "TW":
                mult *= 3
            if block_pos == (r, c):
                blocked = True
        total += value
    score = total * mult
    if blocked:  # Blocking halves only the words that use the blocked square
        score //= 2
    return {"word": text, "score": score, "blocked": blocked}


def _evaluate(state, placements, block_pos=None):
    board = state["board"]
    new = {}
    for p in placements:
        r, c = p["row"], p["col"]
        if not (0 <= r < SIZE and 0 <= c < SIZE):
            raise GameError("That tile is off the board.")
        if board[r][c] is not None or (r, c) in new:
            raise GameError("That square is already taken.")
        new[(r, c)] = p
    rows, cols = {r for r, _ in new}, {c for _, c in new}
    if len(rows) > 1 and len(cols) > 1:
        raise GameError("Tiles must all be in one row or one column.")

    def at(r, c):
        if not (0 <= r < SIZE and 0 <= c < SIZE):
            return None
        if (r, c) in new:
            return (new[(r, c)]["letter"], new[(r, c)]["blank"], True)
        b = board[r][c]
        return (b["l"], b["b"], False) if b else None

    def line(r, c, dr, dc):
        while at(r - dr, c - dc):
            r, c = r - dr, c - dc
        cells = []
        while at(r, c):
            cells.append((r, c) + at(r, c))
            r, c = r + dr, c + dc
        return cells

    r0, c0 = sorted(new)[0]
    if len(new) > 1:
        d = (0, 1) if len(rows) == 1 else (1, 0)
    else:
        d = (0, 1) if len(line(r0, c0, 0, 1)) > 1 else (1, 0)
    main = line(r0, c0, *d)
    if len(main) < 2:
        raise GameError("Words need at least two letters.")
    if not set(new) <= {(cell[0], cell[1]) for cell in main}:
        raise GameError("Tiles must be connected with no gaps.")

    if not any(cell for row in board for cell in row):
        if (CENTER, CENTER) not in new:
            raise GameError("The first word must cover the centre star.")
        if len(new) < 2:
            raise GameError("The first word needs at least two tiles.")
    elif not any(board[r + dr][c + dc] for r, c in new for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
                 if 0 <= r + dr < SIZE and 0 <= c + dc < SIZE):
        raise GameError("Your word must touch a tile already on the board.")

    found = [main]
    for r, c in sorted(new):  # cross-words run the other way
        cross = line(r, c, d[1], d[0])
        if len(cross) > 1:
            found.append(cross)

    scored, bad = [], []
    for cells in found:
        text = "".join(cell[2] for cell in cells)
        if not words.is_valid(text):
            bad.append(text)
        scored.append(_score_word(text, cells, block_pos))
    if bad:
        raise GameError("Not in the dictionary: " + ", ".join(bad) + ".")
    total = sum(w["score"] for w in scored)
    bingo = len(new) == RACK_SIZE
    if bingo:
        total += BINGO_BONUS  # the bonus is never halved
    return {"words": scored, "score": total, "bingo": bingo}


def preview_move(state, pid, raw):
    _require_turn(state, pid)
    placements = _parse(raw)
    _take_from_rack(state["racks"][str(pid)], placements)
    res = _evaluate(state, placements, _block_pos(state, pid))
    return {"ok": True, "score": res["score"], "words": res["words"], "bingo": res["bingo"]}


def submit_move(state, pid, raw):
    _require_turn(state, pid)
    placements = _parse(raw)
    rack = _take_from_rack(state["racks"][str(pid)], placements)
    res = _evaluate(state, placements, _block_pos(state, pid))
    for p in placements:
        state["board"][p["row"]][p["col"]] = {"l": p["letter"], "b": p["blank"]}
    player = _player(state, pid)
    player["score"] += res["score"]
    state["racks"][str(pid)] = rack
    _draw(state, pid)
    state["passes"] = 0
    state["last_move"] = {"pid": pid, "cells": [[p["row"], p["col"]] for p in placements], "score": res["score"],
                          "words": [w["word"] for w in res["words"]]}
    names = ", ".join(w["word"] + (" (blocked)" if w["blocked"] else "") for w in res["words"])
    tile_chips = [{"letter": p["letter"], "blank": p["blank"]} for p in placements]
    _log(state, "%s played %s for %d%s." % (player["name"], names, res["score"], " - BINGO!" if res["bingo"] else ""),
         pid=pid, tiles=tile_chips, score=res["score"])
    if not state["bag"] and not state["racks"][str(pid)]:
        _finish(state, pid, "%s used every tile." % player["name"])
    else:
        _end_turn(state, pid)


def pass_turn(state, pid):
    _require_turn(state, pid)
    _scoreless(state, pid, "%s passed." % _player(state, pid)["name"])


def exchange(state, pid, tiles):
    _require_turn(state, pid)
    if len(state["bag"]) < RACK_SIZE:
        raise GameError("You can only exchange while 7 or more tiles are left in the bag.")
    if not isinstance(tiles, list) or not tiles:
        raise GameError("Pick the tiles to exchange.")
    rack = list(state["racks"][str(pid)])
    give = [str(t).upper() for t in tiles]
    for t in give:
        if t not in rack:
            raise GameError("You don't have the %s tile." % t)
        rack.remove(t)
    state["racks"][str(pid)] = rack
    _draw(state, pid)  # draw first, then return the old tiles
    state["bag"].extend(give)
    random.shuffle(state["bag"])
    _scoreless(state, pid, "%s exchanged %d tile%s." % (_player(state, pid)["name"], len(give), "" if len(give) == 1 else "s"))


# ---------------------------------------------------------------- resign

def resign(state, pid):
    _require_active(state)
    player = _player(state, pid)
    if pid in state["resigned"]:
        raise GameError("You've already resigned.")
    state["resigned"].append(pid)
    _log(state, "%s resigned." % player["name"], pid=pid)
    if state["block"] and pid in (state["block"]["by"], state["block"]["target"]):
        state["block"] = None
    if state["trade"] and pid in (state["trade"]["from"], state["trade"]["to"]):
        state["trade"] = None
    if state["suggestion"] and state["suggestion"]["by"] == pid:
        state["suggestion"] = None

    active = _active(state)
    if len(active) <= 1:
        state["status"] = "finished"
        state["winners"] = [active[0]["id"]] if active else []
        state["final"] = [{"id": p["id"], "name": p["name"], "base": p["score"], "leftover": 0, "bonus": 0, "score": p["score"]}
                          for p in state["players"]]
        state["ended_reason"] = "%s resigned." % player["name"]
        _log(state, "Game over. " + state["ended_reason"])
        return
    if state["players"][state["turn"]]["id"] == pid:
        state["turn"] = _advance(state, state["turn"])
        state["turn_no"] += 1


# ---------------------------------------------------------------- Assist

def suggest(state, pid, word, row, col, direction):
    _require_active(state)
    me = _player(state, pid)
    if pid in state["resigned"]:
        raise GameError("You've resigned from this game.")
    if state["players"][state["turn"]]["id"] == pid:
        raise GameError("You can't suggest a move to yourself.")
    if state["assist_used"]:
        raise GameError("An assist was already used this turn.")
    word = str(word or "").strip().upper()
    row, col = int(row), int(col)
    if direction not in ("across", "down"):
        raise GameError("Choose across or down.")
    if len(word) < 2 or not word.isalpha() or not word.isascii():
        raise GameError("Suggest a word of two or more letters.")
    end = (row, col + len(word) - 1) if direction == "across" else (row + len(word) - 1, col)
    if not (0 <= row < SIZE and 0 <= col < SIZE and end[0] < SIZE and end[1] < SIZE):
        raise GameError("That word runs off the board.")
    if not words.is_valid(word):
        raise GameError("%s isn't in the dictionary." % word)
    state["suggestion"] = {"id": uuid.uuid4().hex[:8], "by": pid, "by_name": me["name"], "word": word,
                           "row": row, "col": col, "direction": direction}
    state["assist_used"] = True
    _log(state, "%s suggested %s." % (me["name"], word))


def _placements_for(state, pid, s):
    dr, dc = (0, 1) if s["direction"] == "across" else (1, 0)
    rack = list(state["racks"][str(pid)])
    out = []
    for i, ch in enumerate(s["word"]):
        r, c = s["row"] + dr * i, s["col"] + dc * i
        cell = state["board"][r][c]
        if cell:
            if cell["l"] != ch:
                raise GameError("That word doesn't fit the tiles already on the board.")
            continue
        if ch in rack:
            rack.remove(ch)
            out.append({"row": r, "col": c, "letter": ch, "blank": False})
        elif "?" in rack:
            rack.remove("?")
            out.append({"row": r, "col": c, "letter": ch, "blank": True})
        else:
            raise GameError("You don't have the tiles for %s." % s["word"])
    if not out:
        raise GameError("That word is already on the board.")
    return out


def respond_assist(state, pid, accept):
    """Accepting returns the tiles to place; the player must still submit the move themselves."""
    _require_turn(state, pid)
    s = state["suggestion"]
    if not s:
        raise GameError("There's no suggestion to answer.")
    name = _player(state, pid)["name"]
    if not accept:
        state["suggestion"] = None
        _log(state, "%s passed on the suggestion %s." % (name, s["word"]))
        return None
    placements = _placements_for(state, pid, s)
    state["suggestion"] = None
    _log(state, "%s accepted the suggestion %s." % (name, s["word"]))
    return placements


# ---------------------------------------------------------------- Block

def place_block(state, pid, row, col):
    _require_active(state)
    me = _player(state, pid)
    if pid in state["resigned"]:
        raise GameError("You've resigned from this game.")
    row, col = int(row), int(col)
    if not (0 <= row < SIZE and 0 <= col < SIZE):
        raise GameError("Pick a square on the board.")
    if state["board"][row][col]:
        raise GameError("That square already has a tile.")
    if state["block"]:
        raise GameError("A square is already blocked.")
    if state["block_used"].get(str(pid)) == state["round"]:
        raise GameError("You've already blocked a square this round.")
    target = _next_player(state)
    if target["id"] == pid:
        raise GameError("You can't block your own turn. Block during your turn, or while a third player is up.")
    state["block"] = {"row": row, "col": col, "by": pid, "target": target["id"]}
    state["block_used"][str(pid)] = state["round"]
    _log(state, "%s blocked a square for %s's next turn." % (me["name"], target["name"]))


# ---------------------------------------------------------------- Tile trading

def propose_trade(state, pid, to_id, give):
    _require_active(state)
    me = _player(state, pid)
    to_id = int(to_id)
    other = _player(state, to_id)
    give = str(give or "").upper()
    if pid in state["resigned"] or to_id in state["resigned"]:
        raise GameError("A resigned player can't take part in a trade.")
    if to_id == pid:
        raise GameError("Pick another player to trade with.")
    if state["trade"]:
        raise GameError("A trade is already waiting for an answer.")
    if state["trade_used"].get(str(pid)) == state["round"]:
        raise GameError("You've already traded this round.")
    if give not in state["racks"][str(pid)]:
        raise GameError("You don't have that tile.")
    state["trade"] = {"id": uuid.uuid4().hex[:8], "from": pid, "from_name": me["name"], "to": to_id, "to_name": other["name"], "give": give}
    _log(state, "%s offered a tile to %s." % (me["name"], other["name"]))


def respond_trade(state, pid, accept, give_back=None):
    _require_active(state)
    t = state["trade"]
    if not t or t["to"] != pid:
        raise GameError("There's no trade waiting for you.")
    me = _player(state, pid)
    if not accept:
        state["trade"] = None
        _log(state, "%s declined the trade from %s." % (me["name"], t["from_name"]))
        return
    give_back = str(give_back or "").upper()
    mine, theirs = state["racks"][str(pid)], state["racks"][str(t["from"])]
    if give_back not in mine:
        raise GameError("Pick one of your tiles to give back.")
    if t["give"] not in theirs:
        state["trade"] = None
        raise GameError("%s no longer has that tile, so the trade was cancelled." % t["from_name"])
    mine.remove(give_back)
    theirs.remove(t["give"])
    mine.append(t["give"])
    theirs.append(give_back)
    state["trade_used"][str(t["from"])] = state["round"]
    state["trade"] = None
    _log(state, "%s and %s traded tiles." % (t["from_name"], me["name"]))


def cancel_trade(state, pid):
    t = state["trade"]
    if not t or t["from"] != pid:
        raise GameError("You have no trade to cancel.")
    state["trade"] = None
    _log(state, "%s cancelled their trade offer." % t["from_name"])


# ---------------------------------------------------------------- chat

def add_chat(state, pid, text):
    me = _player(state, pid)
    text = " ".join(str(text).split())[:300]
    if text:
        state["chat"].append({"pid": pid, "name": me["name"], "text": text, "t": int(time.time())})
        del state["chat"][:-200]
