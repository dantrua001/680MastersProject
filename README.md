# Cooperative Scrabble

Real-time multiplayer Scrabble (2 to 4 players) with three player interactions: **Assist**, **Block** and **Tile Trading**, plus in-game chat and saved games.

Stack: React + Vite + Tailwind (frontend) and FastAPI + SQLAlchemy + WebSockets (backend). It uses SQLite by default so it runs with no database setup, and switches to PostgreSQL with one line in `.env`.

## Run it in VS Code

You need **Python 3.9+** and **Node 18+**. Open the `cooperative-scrabble` folder in VS Code and use two terminals (Terminal > New Terminal).

**Terminal 1: backend**

```bash
cd backend
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

On first start the server downloads a public-domain Scrabble word list (ENABLE) into `backend/app/data/words.txt`. If your network blocks it, put any word list there yourself, one word per line. Until a list exists, **any word is accepted** and the lobby shows a warning.

**Terminal 2: frontend**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

**Playing with yourself to test:** every browser profile is its own player, so use one normal window plus one or more private/incognito windows and choose *Continue as guest* in each. Player 1 creates a game and shares the 5-letter code (or invite link); the others join; the host presses *Start game*.

### Using PostgreSQL

Create a database, then copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/scrabble`, uncomment `psycopg2-binary` in `requirements.txt`, and reinstall. Tables are created automatically.

### Tests

```bash
cd backend
python -m unittest discover -s tests -t . -v
```

28 tests cover the board, scoring, cross-words, blanks, bingo, passing and exchanging, resigning, game end, and every cooperative rule. They need no installed packages.

## Also included, beyond the core rules

- **Resign:** ends your part of the game. In a 2-player game the other player wins immediately; in a 3-4 player game, play continues with your seat skipped, and the game ends automatically once only one player is left.
- **Undo (last tile) / Take back tiles:** Undo removes only the most recently placed tile; Take back tiles clears everything you've placed this turn. Neither affects your rack until you press Submit.
- **Shuffle rack:** reorders how your tiles are displayed. Visual only, so it doesn't touch your rack or use your turn.
- **Turn history:** each move shows as a card with the tiles played and the points scored, not just a text line.
- **Tile bag mix:** the lobby's bag counter shows the number of vowels and consonants left, not the exact letters. Showing the exact remaining letters (as some single-player/computer-opponent apps do) would let a player calculate what an opponent is likely to draw next, which isn't fair in real player-vs-player Scrabble, so this app only reveals the mix.

## The six screens

1. **Landing / Authentication:** log in, sign up, or continue as guest.
2. **Game Lobby:** create a game, join by code, resume a game in progress.
3. **Game Room:** code, invite link, players, host starts the game.
4. **Game Board:** board, rack, live score preview, turns, scores, chat, Submit / Pass / Exchange, and the Assist, Block and Trade modals.
5. **Game Results:** final scores, winner, play again.
6. **Saved Games:** every game is saved after each move; resume any unfinished one.

## Rules as implemented

**Standard Scrabble:** 15x15 board, 100 tiles (2 blanks), 7-tile racks, first word covers the centre star, every word formed is scored (across and down only), premium squares count only for newly placed tiles, 50-point bingo for using all 7 tiles. Turn order is Player 1, 2, 3, 4. Words are checked against the dictionary automatically.

**Game end:** the bag is empty and a player uses their last tile, or every player passes/exchanges twice in a row. Each player loses the value of their unplayed tiles; the player who went out gains everyone else's. Highest score wins (ties share the win). Scores are **individual**.

**Round:** one round is complete when every player has taken one turn (playing, passing and exchanging all count).

**Assist (once per turn):** any player except the active one suggests a word, start square and direction. The active player accepts or rejects. Accepting places the tiles from their rack, but they still choose to press Submit.

**Block (once per round):** pick an empty square. On the next player's turn, every word that includes a tile on that square scores **50%** (rounded down); other words that turn score in full, and the 50-point bingo bonus is never halved. The blocked square is visible to everyone and can still be played on.

**Tile Trading (once per round):** offer one of your tiles to another player. They must accept, and choose one of their own tiles to give back, so rack sizes stay at 7.

**Chat:** unlimited.

## Decisions I made where the plan was silent

Change these in `backend/app/engine.py` if your team decides differently.

- **Block timing:** any player can block, even out of turn, but never a turn that is their own. In a 2-player game that means you block during your own turn (the target is your opponent). One block at a time.
- **Assist limit:** one suggestion per turn in total, not one per player. The suggester can't see the rack, so a suggestion may not be playable; accepting tells the player if they lack the tiles.
- **Trade limit:** counted when a trade is *accepted*, so declined or cancelled offers don't use it. One pending offer at a time; trades can be proposed at any time and don't cost a turn.
- **Seats:** Player 1 is the host, then join order.

## Not included yet

- **Timer / game clock:** no per-move or whole-game time limit yet. Resign is the only way to end a game early.
- **Elo / skill rating and computer opponent:** no rating system or AI player; every game is player vs player.
- **Disconnected players:** the game waits for them. Refreshing or reconnecting is fine (the game is saved and resumes), but there is no skip-turn timer or auto-forfeit for going quiet (Resign is manual).
- **Accounts:** passwords use PBKDF2 and sessions use signed tokens from the standard library, which is fine for a class project. For production, set a real `SECRET_KEY` and consider a maintained auth library.
- Challenges and spectators.

## Project layout

```
backend/app/engine.py       Scrabble rules + Assist/Block/Trade (pure Python, tested)
backend/app/realtime.py     WebSocket actions, broadcast, save after every move
backend/app/routers/        auth.py (accounts, guests) and games.py (create, join, start, saved, results)
backend/app/models.py       User, Game, GamePlayer (game state is stored as JSON)
frontend/src/pages/         the six screens
frontend/src/components/    Board, Rack, Tile, Chat, and the Assist/Block/Trade modals
```
