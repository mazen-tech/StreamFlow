"""
StreamFlow – Database Initialisation Script
Run once: python3 init_db.py
Creates streamflow.db with seed data.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "streamflow.db")


def init():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # ── Drop tables if re-running ─────────────────────────────────────
    c.execute("DROP TABLE IF EXISTS movies")
    c.execute("DROP TABLE IF EXISTS categories")
    c.execute("DROP TABLE IF EXISTS plans")

    # ── Categories ────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE categories (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            name     TEXT NOT NULL,
            icon     TEXT NOT NULL,
            color    TEXT NOT NULL,
            count    INTEGER NOT NULL DEFAULT 0
        )
    """)

    categories = [
        ("Akcja",    "💥", "#ef4444", 1240),
        ("Dramat",   "🎭", "#a78bfa", 980),
        ("Komedia",  "😂", "#fbbf24", 760),
        ("Sci-Fi",   "🚀", "#38bdf8", 540),
        ("Horror",   "👁️", "#f87171", 420),
        ("Dokumenty","🎥", "#34d399", 310),
    ]
    c.executemany(
        "INSERT INTO categories (name, icon, color, count) VALUES (?,?,?,?)",
        categories
    )

    # ── Movies / shows ────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE movies (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            year        INTEGER NOT NULL,
            rating      REAL NOT NULL,
            duration    TEXT NOT NULL,
            category    TEXT NOT NULL,
            badge       TEXT,
            is_trending INTEGER NOT NULL DEFAULT 0,
            is_new      INTEGER NOT NULL DEFAULT 0,
            rank_pos    INTEGER,
            poster_css  TEXT NOT NULL DEFAULT 'poster--1',
            poster_icon TEXT NOT NULL DEFAULT '🎬',
            description TEXT
        )
    """)

    movies = [
        # title, year, rating, duration, category, badge, trending, new, rank, poster_css, icon, description
        ("Cień Północy",      2024, 9.1, "Sezon 1",   "Kryminał",  "NOWE",    1, 0, 1, "poster--1",  "🌑", "Mroczny detektyw tropi seryjnego zabójcę w zamarzniętym mieście."),
        ("Głębina",           2024, 8.7, "2h 14min",  "Sci-Fi",    None,      1, 0, 2, "poster--2",  "🌊", "Ekspedycja na dno oceanu odkrywa nieznaną formę życia."),
        ("Rok Wilka",         2023, 8.5, "Sezon 2",   "Dramat",    None,      1, 0, 3, "poster--3",  "🐺", "Rodzinna saga rozgrywająca się na tle konfliktów społecznych."),
        ("Poza Zasięgiem",    2024, 7.9, "1h 48min",  "Thriller",  None,      1, 0, 4, "poster--4",  "📡", "Pilot wojskowy rozbija się na wrogim terytorium bez łączności."),
        ("Kod Zero",          2024, 8.2, "Sezon 1",   "Sensacja",  None,      1, 0, 5, "poster--5",  "💻", "Elitarna jednostka hakerów walczy z cyberterrorystami."),
        ("Burza Doskonała",   2024, 8.0, "2h 03min",  "Dramat",    "PREMIERA",0, 1, None,"poster--6", "⛈️", "Dramatyczna historia ratowników górskich w obliczu kataklizmu."),
        ("Widmo Miasta",      2024, 7.8, "Sezon 1",   "Kryminał",  "NOWE",    0, 1, None,"poster--7", "🏙️", "Detektyw śledzi tajemnicze zniknięcia w wielkim mieście."),
        ("Milczące Wody",     2024, 8.3, "1h 57min",  "Thriller",  "PREMIERA",0, 1, None,"poster--8", "🌊", "Kobieta odkrywa mroczny sekret swojego małego miasteczka."),
        ("Piąty Element",     2024, 8.6, "1h 20min",  "Dokument",  None,      0, 1, None,"poster--9", "🔬", "Dokument o naukowcach szukających piątego stanu skupienia materii."),
        ("Ostatnie Słowa",    2024, 7.5, "Sezon 1",   "Komedia",   None,      0, 1, None,"poster--10","🎙️", "Stand-up komik mierzy się z trudami sławy i rodzinnymi problemami."),
        ("Ostatni Sygnał",    2024, 8.4, "1h 52min",  "Thriller",  None,      0, 0, None,"poster--hero","🎬","Były agent CIA otrzymuje sygnał, który może zmienić losy świata."),
        ("Neon Requiem",      2024, 8.8, "2h 10min",  "Sci-Fi",    "NOWE",    1, 1, None,"poster--1",  "🌆", "W neonowym mieście przyszłości jeden człowiek walczy z systemem."),
        ("Pustka",            2023, 7.6, "1h 38min",  "Horror",    None,      0, 0, None,"poster--3",  "🕳️", "Grupa przyjaciół trafia do domu, w którym czas płynie inaczej."),
        ("Złoty Pył",         2024, 9.0, "Sezon 1",   "Dramat",    "NOWE",    1, 1, None,"poster--5",  "✨", "Saga o dynastii diamentowych górników w Afryce Południowej."),
        ("Bez Wyjścia",       2024, 7.3, "1h 44min",  "Akcja",     None,      0, 0, None,"poster--6",  "🔒", "Policjantka uwięziona w banku podczas napadu zbrojnego."),
    ]

    c.executemany("""
        INSERT INTO movies
            (title,year,rating,duration,category,badge,is_trending,is_new,rank_pos,poster_css,poster_icon,description)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, movies)

    # ── Pricing plans ─────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE plans (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            name     TEXT NOT NULL,
            price    INTEGER NOT NULL,
            featured INTEGER NOT NULL DEFAULT 0,
            features TEXT NOT NULL   -- JSON array stored as text
        )
    """)

    import json
    plans = [
        ("Podstawowy", 19, 0, json.dumps([
            {"text": "Jakość HD (1080p)",       "included": True},
            {"text": "1 ekran jednocześnie",    "included": True},
            {"text": "Dostęp do biblioteki",    "included": True},
            {"text": "Pobieranie offline",      "included": False},
            {"text": "4K Ultra HD",             "included": False},
            {"text": "5 profili",               "included": False},
        ])),
        ("Standard", 39, 1, json.dumps([
            {"text": "Jakość Full HD",          "included": True},
            {"text": "2 ekrany jednocześnie",   "included": True},
            {"text": "Dostęp do biblioteki",    "included": True},
            {"text": "Pobieranie offline",      "included": True},
            {"text": "4K Ultra HD",             "included": False},
            {"text": "3 profile",               "included": True},
        ])),
        ("Premium", 59, 0, json.dumps([
            {"text": "Jakość 4K Ultra HD",      "included": True},
            {"text": "4 ekrany jednocześnie",   "included": True},
            {"text": "Dostęp do biblioteki",    "included": True},
            {"text": "Pobieranie offline",      "included": True},
            {"text": "4K + Dolby Atmos",        "included": True},
            {"text": "5 profili",               "included": True},
        ])),
    ]
    c.executemany(
        "INSERT INTO plans (name, price, featured, features) VALUES (?,?,?,?)",
        plans
    )

    conn.commit()
    conn.close()

    total = 6 + 15 + 3
    print(f"✅  streamflow.db created at: {DB_PATH}")
    print(f"    → {6}  categories")
    print(f"    → {15} movies / shows")
    print(f"    → {3}  pricing plans")
    print(f"    → {total} records total")


if __name__ == "__main__":
    init()
