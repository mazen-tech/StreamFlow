#!/usr/bin/env python3
"""
StreamFlow – Backend Server
Usage: python3 server.py [port]
Default port: 8000

Endpoints:
  GET  /                         → serves frontend (index.html + static files)
  GET  /api/movies               → all movies (optional ?trending=1 &new=1 &category=X &q=search)
  GET  /api/movies/<id>          → single movie
  GET  /api/categories           → all categories
  GET  /api/plans                → pricing plans
  GET  /api/stats                → platform stats
"""

import sys
import os
import json
import sqlite3
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ── Config ────────────────────────────────────────────────────────────────────
PORT       = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DB_PATH    = os.path.join(BASE_DIR, "streamflow.db")
STATIC_DIR = os.path.join(BASE_DIR, "..", "streamflow")   # frontend folder


# ── Database helper ───────────────────────────────────────────────────────────
def get_db():
    if not os.path.exists(DB_PATH):
        print("❌  Database not found. Run: python3 init_db.py")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row   # rows behave like dicts
    return conn


def rows_to_list(rows):
    result = []
    for row in rows:
        item = dict(row)
        # parse JSON features field if present
        if "features" in item and isinstance(item["features"], str):
            try:
                item["features"] = json.loads(item["features"])
            except Exception:
                pass
        result.append(item)
    return result


# ── Request handler ───────────────────────────────────────────────────────────
class StreamFlowHandler(BaseHTTPRequestHandler):

    # suppress access log noise – comment out to see all requests
    def log_message(self, fmt, *args):
        print(f"  [{self.address_string()}] {fmt % args}")

    # ── CORS + JSON response helpers ──────────────────────────────────────────
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type",   "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        self.send_json({"error": message}, status)

    # ── OPTIONS preflight ─────────────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────────────────────
    def do_GET(self):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/") or "/"
        params = parse_qs(parsed.query)

        # ── API routes ────────────────────────────────────────────────────────
        if path.startswith("/api"):
            self.handle_api(path, params)
            return

        # ── Static file serving ───────────────────────────────────────────────
        self.serve_static(path)

    # ── Static file server ────────────────────────────────────────────────────
    def serve_static(self, path):
        if path == "/" or path == "":
            file_path = os.path.join(STATIC_DIR, "index.html")
        else:
            # strip leading slash
            rel = path.lstrip("/")
            file_path = os.path.join(STATIC_DIR, rel)

        # security: prevent path traversal
        real_static = os.path.realpath(STATIC_DIR)
        real_file   = os.path.realpath(file_path)
        if not real_file.startswith(real_static):
            self.send_error_json(403, "Forbidden")
            return

        if not os.path.isfile(file_path):
            # fallback to index.html for SPA-style navigation
            file_path = os.path.join(STATIC_DIR, "index.html")

        try:
            mime, _ = mimetypes.guess_type(file_path)
            mime = mime or "application/octet-stream"
            with open(file_path, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type",   mime)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_error_json(500, str(e))

    # ── API dispatcher ────────────────────────────────────────────────────────
    def handle_api(self, path, params):
        try:
            # GET /api/movies
            if path == "/api/movies":
                self.api_movies(params)

            # GET /api/movies/<id>
            elif path.startswith("/api/movies/"):
                movie_id = path.split("/")[-1]
                if movie_id.isdigit():
                    self.api_movie_detail(int(movie_id))
                else:
                    self.send_error_json(400, "Invalid movie ID")

            # GET /api/categories
            elif path == "/api/categories":
                self.api_categories()

            # GET /api/plans
            elif path == "/api/plans":
                self.api_plans()

            # GET /api/stats
            elif path == "/api/stats":
                self.api_stats()

            else:
                self.send_error_json(404, f"Endpoint '{path}' not found")

        except sqlite3.Error as e:
            self.send_error_json(500, f"Database error: {e}")
        except Exception as e:
            self.send_error_json(500, f"Server error: {e}")

    # ── /api/movies ───────────────────────────────────────────────────────────
    def api_movies(self, params):
        conn = get_db()
        try:
            conditions = []
            args       = []

            if params.get("trending", [""])[0] == "1":
                conditions.append("is_trending = 1")
            if params.get("new", [""])[0] == "1":
                conditions.append("is_new = 1")

            category = params.get("category", [""])[0]
            if category:
                conditions.append("category = ?")
                args.append(category)

            search = params.get("q", [""])[0]
            if search:
                conditions.append("(title LIKE ? OR description LIKE ?)")
                args.extend([f"%{search}%", f"%{search}%"])

            where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
            order = "ORDER BY CASE WHEN rank_pos IS NOT NULL THEN rank_pos ELSE 9999 END, rating DESC"

            rows = conn.execute(
                f"SELECT * FROM movies {where} {order}", args
            ).fetchall()

            self.send_json({
                "data":  rows_to_list(rows),
                "total": len(rows),
            })
        finally:
            conn.close()

    # ── /api/movies/<id> ──────────────────────────────────────────────────────
    def api_movie_detail(self, movie_id):
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT * FROM movies WHERE id = ?", (movie_id,)
            ).fetchone()
            if not row:
                self.send_error_json(404, "Movie not found")
                return
            self.send_json({"data": rows_to_list([row])[0]})
        finally:
            conn.close()

    # ── /api/categories ───────────────────────────────────────────────────────
    def api_categories(self):
        conn = get_db()
        try:
            rows = conn.execute("SELECT * FROM categories ORDER BY id").fetchall()
            self.send_json({
                "data":  rows_to_list(rows),
                "total": len(rows),
            })
        finally:
            conn.close()

    # ── /api/plans ────────────────────────────────────────────────────────────
    def api_plans(self):
        conn = get_db()
        try:
            rows = conn.execute("SELECT * FROM plans ORDER BY price").fetchall()
            self.send_json({
                "data":  rows_to_list(rows),
                "total": len(rows),
            })
        finally:
            conn.close()

    # ── /api/stats ────────────────────────────────────────────────────────────
    def api_stats(self):
        conn = get_db()
        try:
            total_movies    = conn.execute("SELECT COUNT(*) FROM movies").fetchone()[0]
            total_categories= conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
            avg_rating      = conn.execute("SELECT ROUND(AVG(rating),1) FROM movies").fetchone()[0]
            total_titles_sum= conn.execute("SELECT SUM(count) FROM categories").fetchone()[0]

            self.send_json({"data": {
                "total_titles":     total_titles_sum or 10000,
                "quality":          "4K",
                "profiles":         5,
                "support":          "24/7",
                "movies_in_db":     total_movies,
                "categories_count": total_categories,
                "average_rating":   avg_rating,
            }})
        finally:
            conn.close()


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("⚠️  Database not found – running init_db.py first...")
        import init_db
        init_db.init()

    server = HTTPServer(("0.0.0.0", PORT), StreamFlowHandler)
    print(f"""
╔══════════════════════════════════════════════════════╗
║         StreamFlow Backend – Python / SQLite         ║
╠══════════════════════════════════════════════════════╣
║  Server:    http://localhost:{PORT:<26}║
║  Frontend:  http://localhost:{PORT}                    ║
╠══════════════════════════════════════════════════════╣
║  API Endpoints:                                      ║
║    GET /api/movies              all movies           ║
║    GET /api/movies?trending=1   trending             ║
║    GET /api/movies?new=1        new releases         ║
║    GET /api/movies?q=query      search               ║
║    GET /api/movies/<id>         single movie         ║
║    GET /api/categories          categories           ║
║    GET /api/plans               pricing plans        ║
║    GET /api/stats               platform stats       ║
╠══════════════════════════════════════════════════════╣
║  Press Ctrl+C to stop                                ║
╚══════════════════════════════════════════════════════╝
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑  Server stopped.")
        server.server_close()
