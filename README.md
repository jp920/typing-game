# Typing Quest

A colorful, kid-friendly typing-skills game. Players race a falling-letter city
skyline, earn points, and climb a difficulty ladder. Progress, streaks, and a
monthly practice calendar are tracked per player.

Built for a small home LAN: a single FastAPI process backed by SQLite, served
behind Caddy at `/typing`.

## Stack

- **Backend:** FastAPI + SQLite (Python stdlib `sqlite3`) + `httpx`
- **Frontend:** vanilla HTML/CSS/JS (no build step) in [`static/`](static/)
- **Serving:** uvicorn on `127.0.0.1:8001`, reverse-proxied by Caddy

## How it works

- **Profiles** are a fixed roster of 8 players defined in [`app.py`](app.py)
  (`PROFILES`). Each has an avatar, color, and a `target_scale` that lowers WPM
  goals for younger kids. Profiles are upserted into the DB on startup.
- **Gameplay** runs entirely in the browser ([`static/app.js`](static/app.js),
  [`static/city.js`](static/city.js)). When a round ends, the result is POSTed
  to `/api/score`.
- **Book vocab:** players can theme their words on a favorite book. Titles are
  matched first against a curated library (Harry Potter, Wimpy Kid, Percy
  Jackson, Dog Man, Warriors), then looked up on Project Gutenberg via
  [gutendex](https://gutendex.com/); pasted text is also supported. Distinctive
  words, likely character names, and short phrases are extracted and stored on
  the profile.
- **Adaptive drills:** per-key accuracy (`ok`/`err` counts) is accumulated per
  profile to target weak keys.
- **Leaderboard & calendar** are aggregated on demand from the `scores` table.

## Data storage

All persistent data lives in a single **SQLite file** written by the backend.

- **Location:** the `TYPING_DB` env var, defaulting to `game.db` next to
  `app.py`. In production it is pinned to `/home/jp/typing-game/game.db`.
- **Tables:**
  - `profiles` — roster, per-player `level` / `weight_speed`, chosen book
    (`book_title`, `book_vocab` JSON), and cumulative `key_stats` JSON.
  - `scores` — one row per completed round (points, wpm, accuracy, level, active
    `seconds`, `local_date`, timestamp).
- The browser stores nothing persistent except the mute toggle in
  `localStorage`, so progress follows a player to any device on the LAN.

The DB file is gitignored and is never committed.

## Running locally

```bash
python -m venv .venv
. .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8001
```

Then open <http://127.0.0.1:8001/>. To use a custom DB path:

```bash
TYPING_DB=/path/to/game.db uvicorn app:app --port 8001
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET`    | `/api/profiles` | Roster with `has_book` / `grade` |
| `GET`    | `/api/profile/{name}` | Full profile incl. vocab and key stats |
| `PUT`    | `/api/profile/{name}/settings` | Update `level` / `weight_speed` |
| `POST`   | `/api/profile/{name}/book` | Set book by title or pasted text |
| `DELETE` | `/api/profile/{name}/book` | Clear the chosen book |
| `POST`   | `/api/score` | Submit a completed round |
| `GET`    | `/api/leaderboard?month=YYYY-MM` | Best scores + monthly time totals |
| `GET`    | `/api/calendar?month=YYYY-MM` | Per-day, per-profile active seconds |
| `GET`    | `/healthz` | Liveness check |

## Deployment

The game runs as its own systemd service, fully independent of the Tasks app on
the same box (separate process, port, and database). See [`deploy/`](deploy/):

- [`typing-game.service`](deploy/typing-game.service) — uvicorn on `:8001`
- [`Caddyfile`](deploy/Caddyfile) — adds the `/typing` route
- [`install.sh`](deploy/install.sh) — one-shot installer (validates and backs up
  the Caddyfile before swapping it)

```bash
sudo bash /home/jp/typing-game/deploy/install.sh
```

Live at `http://<LAN_IP>/typing/`.
