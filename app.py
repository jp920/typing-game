"""
Typing Quest — a colorful typing-skills game for the zima box.

Runs as its own uvicorn service on 127.0.0.1:8001, fronted by Caddy at /typing.
Completely independent of the Tasks app on port 80 — separate process, separate
port, separate database. No collision.

Stack: FastAPI + SQLite (stdlib) + httpx (for Project Gutenberg lookups).
"""
from __future__ import annotations

import os
import re
import json
import sqlite3
import string
from collections import Counter
from contextlib import contextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = Path(os.environ.get("TYPING_DB", BASE_DIR / "game.db"))

app = FastAPI(title="Typing Quest")

# --------------------------------------------------------------------------- #
# Profiles — fixed roster.  target_scale lowers WPM goals for the kids so the
# difficulty ladder stays achievable for them.
# --------------------------------------------------------------------------- #
PROFILES = [
    {"name": "Arpine", "avatar": "garden",    "color": "#2e8b57", "age": None, "target_scale": 1.0},
    {"name": "Ema",    "avatar": "goth",      "color": "#7b2d8b", "age": 12,   "target_scale": 0.7},
    {"name": "John",   "avatar": "hulk",      "color": "#2ecc40", "age": 10,   "target_scale": 0.6},
    {"name": "Justin", "avatar": "goat",      "color": "#b5651d", "age": None, "target_scale": 1.0},
    {"name": "Mia",    "avatar": "ballerina", "color": "#e91e8c", "age": 14, "target_scale": 0.8,  "grade": "Freshman"},
    {"name": "Becca",  "avatar": "musician",  "color": "#7b1fa2", "age": 11, "target_scale": 0.65, "grade": "6th Grade"},
    {"name": "Jason",  "avatar": "fireman",   "color": "#e64a19", "age": None, "target_scale": 1.0},
    {"name": "Jess",   "avatar": "doctor",    "color": "#00897b", "age": None, "target_scale": 1.0},
]
PROFILE_NAMES = {p["name"] for p in PROFILES}
PROFILE_META  = {p["name"]: p for p in PROFILES}


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #
@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                name          TEXT PRIMARY KEY,
                avatar        TEXT NOT NULL,
                color         TEXT NOT NULL,
                age           INTEGER,
                target_scale  REAL NOT NULL DEFAULT 1.0,
                level         INTEGER NOT NULL DEFAULT 1,
                weight_speed  INTEGER NOT NULL DEFAULT 50,
                book_title    TEXT,
                book_vocab    TEXT,   -- json: {words:[], phrases:[], names:[]}
                key_stats     TEXT    -- json: {"a":{"ok":N,"err":M}, ...}
            );
            CREATE TABLE IF NOT EXISTS scores (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                profile     TEXT NOT NULL,
                mode        TEXT NOT NULL,          -- 'practice' | 'challenge'
                points      INTEGER NOT NULL,
                wpm         REAL NOT NULL,
                accuracy    REAL NOT NULL,
                level       INTEGER NOT NULL,
                seconds     REAL NOT NULL DEFAULT 0,   -- active round duration
                local_date  TEXT,                      -- player's local date 'YYYY-MM-DD'
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        # Migrate older DBs that predate the time-tracking columns.
        cols = {r[1] for r in conn.execute("PRAGMA table_info(scores)").fetchall()}
        if "seconds" not in cols:
            conn.execute("ALTER TABLE scores ADD COLUMN seconds REAL NOT NULL DEFAULT 0")
        if "book_title" not in cols:
            conn.execute("ALTER TABLE scores ADD COLUMN book_title TEXT")
        if "local_date" not in cols:
            conn.execute("ALTER TABLE scores ADD COLUMN local_date TEXT")
        for p in PROFILES:
            conn.execute(
                """INSERT INTO profiles (name, avatar, color, age, target_scale)
                   VALUES (?,?,?,?,?)
                   ON CONFLICT(name) DO UPDATE SET
                       avatar=excluded.avatar, color=excluded.color,
                       age=excluded.age, target_scale=excluded.target_scale""",
                (p["name"], p["avatar"], p["color"], p["age"], p["target_scale"]),
            )


@app.on_event("startup")
def _startup():
    init_db()


def profile_row(name: str) -> sqlite3.Row:
    with db() as conn:
        row = conn.execute("SELECT * FROM profiles WHERE name=?", (name,)).fetchone()
    if not row:
        raise HTTPException(404, "Unknown profile")
    return row


def profile_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["book_vocab"] = json.loads(d["book_vocab"]) if d["book_vocab"] else None
    d["key_stats"] = json.loads(d["key_stats"]) if d["key_stats"] else {}
    return d


# --------------------------------------------------------------------------- #
# Curated book vocab — for in-copyright kid favorites that aren't on Gutenberg.
# Keyed by lowercase substring match on the title the player types.
# --------------------------------------------------------------------------- #
CURATED = {
    "harry potter": {
        "names": ["Harry", "Hermione", "Ron", "Dumbledore", "Hogwarts", "Voldemort",
                  "Snape", "Hagrid", "Gryffindor", "Slytherin", "Quidditch", "Dobby"],
        "words": ["wizard", "wand", "spell", "magic", "potion", "broomstick", "owl",
                  "castle", "dragon", "goblin", "patronus", "muggle", "cloak", "scar"],
        "phrases": ["the boy who lived", "expecto patronum", "wingardium leviosa",
                    "house of gryffindor", "the chamber of secrets"],
    },
    "wimpy kid": {
        "names": ["Greg", "Rowley", "Manny", "Rodrick", "Heffley", "Fregley"],
        "words": ["diary", "journal", "school", "cheese", "middle", "brother", "video",
                  "comic", "lazy", "summer", "trouble", "cabin"],
        "phrases": ["the cheese touch", "zoo wee mama", "long haul", "dog days"],
    },
    "percy jackson": {
        "names": ["Percy", "Annabeth", "Grover", "Poseidon", "Olympus", "Chiron",
                  "Luke", "Zeus", "Hades", "Medusa"],
        "words": ["demigod", "trident", "lightning", "monster", "quest", "camp",
                  "prophecy", "sword", "ocean", "titan", "hero", "mortal"],
        "phrases": ["the lightning thief", "camp half blood", "son of poseidon"],
    },
    "dog man": {
        "names": ["Dog", "Man", "Petey", "Lil", "Cat", "Flippy", "Sarah"],
        "words": ["police", "hero", "robot", "fish", "comic", "supa", "buddies",
                  "sidekick", "rescue", "city", "bark", "chief"],
        "phrases": ["dog man rises", "for whom the ball rolls", "lord of the fleas"],
    },
    "warriors": {
        "names": ["Firestar", "Graystripe", "Bluestar", "Tigerclaw", "ThunderClan",
                  "RiverClan", "ShadowClan", "WindClan"],
        "words": ["warrior", "clan", "forest", "prey", "hunt", "territory", "leader",
                  "kitten", "claws", "moonstone", "prophecy", "battle"],
        "phrases": ["into the wild", "fire alone can save", "the warrior code"],
    },
}

STOPWORDS = set(
    """a an the and or but if then than that this these those of to in on at by for with
    from as is are was were be been being it its he she they them his her their our your my
    you i we us me him not no nor so too very can will just don't dont said say says into out
    up down over under again more most some any all each every which who whom whose what when
    where why how about above after before between both few many much other such only own same
    here there now once while because until against during without within along across behind
    among around upon toward towards off near per via had has have having do does did doing
    would could should might must shall may am being am'""".split()
)


def extract_vocab(text: str) -> dict:
    """Pull distinctive words, likely character names, and short phrases from raw text."""
    # Character names: capitalized words that recur and aren't common stopwords
    cap = Counter(re.findall(r"\b([A-Z][a-z]{2,})\b", text))
    names = [w for w, c in cap.most_common(40)
             if c >= 4 and w.lower() not in STOPWORDS][:14]

    lower = text.lower()
    tokens = re.findall(r"[a-z']{3,}", lower)
    freq = Counter(t for t in tokens if t not in STOPWORDS and "'" not in t)
    words = [w for w, _ in freq.most_common(60) if 3 <= len(w) <= 11][:30]

    # Phrases: frequent bigrams/trigrams whose words aren't all stopwords
    words_seq = [t for t in re.findall(r"[a-z']+", lower)]
    phrases = []
    for n in (3, 2):
        grams = Counter(
            " ".join(words_seq[i:i + n])
            for i in range(len(words_seq) - n + 1)
            if not all(words_seq[j] in STOPWORDS for j in range(i, i + n))
            and all(len(words_seq[j]) > 1 for j in range(i, i + n))
        )
        for g, c in grams.most_common(40):
            if c >= 3 and len(g) <= 32 and g not in phrases:
                phrases.append(g)
            if len(phrases) >= 8:
                break
    return {"names": names[:14], "words": words[:30], "phrases": phrases[:8]}


# --------------------------------------------------------------------------- #
# Project Gutenberg lookup via gutendex (JSON API over Gutenberg).
# --------------------------------------------------------------------------- #
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")


def fetch_gutenberg(title: str) -> dict | None:
    try:
        with httpx.Client(timeout=15, follow_redirects=True,
                          headers={"User-Agent": UA}) as client:
            r = client.get("https://gutendex.com/books/", params={"search": title})
            r.raise_for_status()
            results = r.json().get("results", [])
            if not results:
                return None
            book = results[0]
            formats = book.get("formats", {})
            text_url = (
                formats.get("text/plain; charset=utf-8")
                or formats.get("text/plain")
                or next((v for k, v in formats.items()
                         if k.startswith("text/plain") and not v.endswith(".zip")), None)
            )
            if not text_url:
                return None
            t = client.get(text_url)
            t.raise_for_status()
            body = t.text
            # Trim Gutenberg header/footer
            start = body.find("*** START")
            end = body.find("*** END")
            if start != -1:
                body = body[body.find("\n", start) + 1:]
            if end != -1:
                body = body[:body.rfind("*** END")]
            vocab = extract_vocab(body[:400_000])
            vocab["source"] = f"Project Gutenberg — {book.get('title', title)}"
            vocab["resolved_title"] = book.get("title", title)
            return vocab
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# API models
# --------------------------------------------------------------------------- #
class SettingsIn(BaseModel):
    weight_speed: int | None = None
    level: int | None = None


class BookIn(BaseModel):
    title: str | None = None
    text: str | None = None


class ScoreIn(BaseModel):
    profile: str
    mode: str
    points: int
    wpm: float
    accuracy: float
    level: int
    seconds: float = 0
    local_date: str | None = None
    key_stats: dict | None = None
    book_title: str | None = None


# --------------------------------------------------------------------------- #
# API routes  (Caddy strips the /typing prefix, so paths here are root-relative)
# --------------------------------------------------------------------------- #
@app.get("/api/profiles")
def get_profiles():
    with db() as conn:
        rows = conn.execute("SELECT * FROM profiles ORDER BY rowid").fetchall()
    return [
        {k: v for k, v in profile_dict(r).items() if k not in ("book_vocab",)}
        | {"has_book": bool(r["book_vocab"])}
        | {"grade": PROFILE_META.get(r["name"], {}).get("grade")}
        for r in rows
    ]


@app.get("/api/profile/{name}")
def get_profile(name: str):
    return profile_dict(profile_row(name))


@app.put("/api/profile/{name}/settings")
def put_settings(name: str, s: SettingsIn):
    profile_row(name)
    with db() as conn:
        if s.weight_speed is not None:
            conn.execute("UPDATE profiles SET weight_speed=? WHERE name=?",
                         (max(0, min(100, s.weight_speed)), name))
        if s.level is not None:
            conn.execute("UPDATE profiles SET level=? WHERE name=?",
                         (max(1, min(10, s.level)), name))
    return profile_dict(profile_row(name))


@app.post("/api/profile/{name}/book")
def set_book(name: str, b: BookIn):
    profile_row(name)
    vocab = None
    title = (b.title or "").strip()
    if b.text and b.text.strip():
        vocab = extract_vocab(b.text)
        vocab["source"] = "Pasted text"
        vocab["resolved_title"] = title or "My book"
        title = title or "My book"
    elif title:
        key = title.lower()
        match = next((v for k, v in CURATED.items() if k in key), None)
        if match:
            vocab = dict(match)
            vocab["source"] = "Curated library"
            vocab["resolved_title"] = title
        else:
            vocab = fetch_gutenberg(title)
    if not vocab or (not vocab.get("words") and not vocab.get("names")):
        raise HTTPException(
            422,
            "Couldn't find vocabulary for that book. Try a classic title, paste an "
            "excerpt, or pick a curated favorite (Harry Potter, Wimpy Kid, Percy "
            "Jackson, Dog Man, Warriors).",
        )
    with db() as conn:
        conn.execute("UPDATE profiles SET book_title=?, book_vocab=? WHERE name=?",
                     (vocab.get("resolved_title", title), json.dumps(vocab), name))
    return {"ok": True, "title": vocab.get("resolved_title", title),
            "source": vocab.get("source"), "vocab": vocab}


@app.delete("/api/profile/{name}/book")
def clear_book(name: str):
    profile_row(name)
    with db() as conn:
        conn.execute("UPDATE profiles SET book_title=NULL, book_vocab=NULL WHERE name=?", (name,))
    return {"ok": True}


@app.post("/api/score")
def post_score(s: ScoreIn):
    if s.profile not in PROFILE_NAMES:
        raise HTTPException(404, "Unknown profile")
    if s.mode not in ("practice", "challenge"):
        raise HTTPException(422, "Bad mode")
    with db() as conn:
        conn.execute(
            """INSERT INTO scores (profile, mode, points, wpm, accuracy, level, seconds, local_date, book_title)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (s.profile, s.mode, int(s.points), float(s.wpm), float(s.accuracy),
             int(s.level), max(0.0, float(s.seconds)), s.local_date, s.book_title),
        )
        # Merge per-key stats for adaptive drills
        if s.key_stats:
            row = conn.execute("SELECT key_stats FROM profiles WHERE name=?", (s.profile,)).fetchone()
            cur = json.loads(row["key_stats"]) if row["key_stats"] else {}
            for k, v in s.key_stats.items():
                slot = cur.setdefault(k, {"ok": 0, "err": 0})
                slot["ok"] += int(v.get("ok", 0))
                slot["err"] += int(v.get("err", 0))
            conn.execute("UPDATE profiles SET key_stats=? WHERE name=?",
                         (json.dumps(cur), s.profile))
    return {"ok": True}


@app.get("/api/leaderboard")
def leaderboard(month: str | None = None):
    """month = 'YYYY-MM' (player's local month) for the monthly time total."""
    like = (month or "") + "%"
    with db() as conn:
        out = []
        for p in PROFILES:
            agg = conn.execute(
                """SELECT MAX(points) bp, MAX(wpm) bw, MAX(accuracy) ba, COUNT(*) games
                   FROM scores WHERE profile=?""", (p["name"],)).fetchone()
            ch = conn.execute(
                "SELECT MAX(points) bp FROM scores WHERE profile=? AND mode='challenge'",
                (p["name"],)).fetchone()
            if month:
                ms = conn.execute(
                    "SELECT COALESCE(SUM(seconds),0) s FROM scores WHERE profile=? AND local_date LIKE ?",
                    (p["name"], like)).fetchone()
            else:
                ms = conn.execute(
                    "SELECT COALESCE(SUM(seconds),0) s FROM scores WHERE profile=?",
                    (p["name"],)).fetchone()
            pr = conn.execute("SELECT level FROM profiles WHERE name=?", (p["name"],)).fetchone()
            out.append({
                "name": p["name"], "avatar": p["avatar"], "color": p["color"],
                "best_points": agg["bp"] or 0,
                "best_challenge": ch["bp"] or 0,
                "best_wpm": round(agg["bw"] or 0, 1),
                "best_accuracy": round(agg["ba"] or 0, 1),
                "games": agg["games"] or 0,
                "month_seconds": int(ms["s"] or 0),
                "level": pr["level"] if pr else 1,
            })
    out.sort(key=lambda r: r["best_challenge"], reverse=True)
    return out


@app.get("/api/calendar")
def calendar(month: str):
    """Per-day, per-profile active seconds for the given 'YYYY-MM' (player local month).
       Returns {"YYYY-MM-DD": [{"profile","avatar","color","seconds"}, ...]}."""
    meta = {p["name"]: p for p in PROFILES}
    with db() as conn:
        rows = conn.execute(
            """SELECT local_date, profile, COALESCE(SUM(seconds),0) s
               FROM scores WHERE local_date LIKE ?
               GROUP BY local_date, profile""", (month + "%",)).fetchall()
    days: dict[str, list] = {}
    for r in rows:
        if not r["local_date"] or not r["s"]:
            continue
        m = meta.get(r["profile"], {})
        days.setdefault(r["local_date"], []).append({
            "profile": r["profile"], "avatar": m.get("avatar"),
            "color": m.get("color"), "seconds": int(r["s"]),
        })
    for d in days.values():
        d.sort(key=lambda x: x["seconds"], reverse=True)
    return days


# --------------------------------------------------------------------------- #
# Static frontend.  index.html sets <base href="/typing/"> so all relative
# asset + fetch URLs resolve correctly behind the Caddy /typing route.
# --------------------------------------------------------------------------- #
@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/healthz")
def healthz():
    return JSONResponse({"ok": True})


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
