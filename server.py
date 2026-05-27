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
  GET  /api/openapi.json         → OpenAPI 3.0 spec
  GET  /api/docs                 → Swagger UI
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


# ── OpenAPI 3.0 Specification ─────────────────────────────────────────────────
def build_openapi_spec(host: str) -> dict:
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "StreamFlow API",
            "description": (
                "REST API for the StreamFlow streaming platform. "
                "Provides access to movies, categories, pricing plans, and platform statistics."
            ),
            "version": "1.0.0",
            "contact": {
                "name": "StreamFlow Support",
                "email": "support@streamflow.example"
            },
        },
        "servers": [
            {"url": f"http://{host}", "description": "Local development server"}
        ],
        "tags": [
            {"name": "Movies",     "description": "Browse and search the movie/show catalogue"},
            {"name": "Categories", "description": "Content genre categories"},
            {"name": "Plans",      "description": "Subscription pricing plans"},
            {"name": "Stats",      "description": "Platform-wide statistics"},
        ],
        "paths": {
            "/api/movies": {
                "get": {
                    "tags": ["Movies"],
                    "summary": "List movies",
                    "description": "Returns all movies. Supports filtering by trending flag, new-release flag, category name, and full-text search.",
                    "operationId": "listMovies",
                    "parameters": [
                        {
                            "name": "trending",
                            "in": "query",
                            "description": "Filter to trending titles only",
                            "required": False,
                            "schema": {"type": "integer", "enum": [0, 1]},
                            "example": 1,
                        },
                        {
                            "name": "new",
                            "in": "query",
                            "description": "Filter to new-release titles only",
                            "required": False,
                            "schema": {"type": "integer", "enum": [0, 1]},
                            "example": 1,
                        },
                        {
                            "name": "category",
                            "in": "query",
                            "description": "Filter by category name (e.g. Sci-Fi, Dramat)",
                            "required": False,
                            "schema": {"type": "string"},
                            "example": "Sci-Fi",
                        },
                        {
                            "name": "q",
                            "in": "query",
                            "description": "Full-text search across title and description",
                            "required": False,
                            "schema": {"type": "string"},
                            "example": "detektyw",
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": "Successful response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "data":  {"type": "array", "items": {"$ref": "#/components/schemas/Movie"}},
                                            "total": {"type": "integer", "example": 15},
                                        },
                                    }
                                }
                            },
                        },
                        "500": {"$ref": "#/components/responses/ServerError"},
                    },
                }
            },
            "/api/movies/{id}": {
                "get": {
                    "tags": ["Movies"],
                    "summary": "Get a single movie",
                    "description": "Returns full details for one movie or show by its numeric ID.",
                    "operationId": "getMovie",
                    "parameters": [
                        {
                            "name": "id",
                            "in": "path",
                            "required": True,
                            "description": "Numeric movie ID",
                            "schema": {"type": "integer"},
                            "example": 1,
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Successful response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "data": {"$ref": "#/components/schemas/Movie"}
                                        },
                                    }
                                }
                            },
                        },
                        "400": {"$ref": "#/components/responses/BadRequest"},
                        "404": {"$ref": "#/components/responses/NotFound"},
                        "500": {"$ref": "#/components/responses/ServerError"},
                    },
                }
            },
            "/api/categories": {
                "get": {
                    "tags": ["Categories"],
                    "summary": "List categories",
                    "description": "Returns all content genre categories with their display icon, colour, and title count.",
                    "operationId": "listCategories",
                    "responses": {
                        "200": {
                            "description": "Successful response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "data":  {"type": "array", "items": {"$ref": "#/components/schemas/Category"}},
                                            "total": {"type": "integer", "example": 6},
                                        },
                                    }
                                }
                            },
                        },
                        "500": {"$ref": "#/components/responses/ServerError"},
                    },
                }
            },
            "/api/plans": {
                "get": {
                    "tags": ["Plans"],
                    "summary": "List pricing plans",
                    "description": "Returns all available subscription plans ordered by price ascending.",
                    "operationId": "listPlans",
                    "responses": {
                        "200": {
                            "description": "Successful response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "data":  {"type": "array", "items": {"$ref": "#/components/schemas/Plan"}},
                                            "total": {"type": "integer", "example": 3},
                                        },
                                    }
                                }
                            },
                        },
                        "500": {"$ref": "#/components/responses/ServerError"},
                    },
                }
            },
            "/api/stats": {
                "get": {
                    "tags": ["Stats"],
                    "summary": "Platform statistics",
                    "description": "Returns high-level platform numbers: total titles, quality tier, profile limit, support hours, and live DB counts.",
                    "operationId": "getStats",
                    "responses": {
                        "200": {
                            "description": "Successful response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "data": {"$ref": "#/components/schemas/Stats"}
                                        },
                                    }
                                }
                            },
                        },
                        "500": {"$ref": "#/components/responses/ServerError"},
                    },
                }
            },
        },
        "components": {
            "schemas": {
                "Movie": {
                    "type": "object",
                    "properties": {
                        "id":          {"type": "integer", "example": 1},
                        "title":       {"type": "string",  "example": "Cień Północy"},
                        "year":        {"type": "integer", "example": 2024},
                        "rating":      {"type": "number",  "format": "float", "example": 9.1},
                        "duration":    {"type": "string",  "example": "Sezon 1"},
                        "category":    {"type": "string",  "example": "Kryminał"},
                        "badge":       {"type": "string",  "nullable": True, "example": "NOWE"},
                        "is_trending": {"type": "integer", "enum": [0, 1], "example": 1},
                        "is_new":      {"type": "integer", "enum": [0, 1], "example": 0},
                        "rank_pos":    {"type": "integer", "nullable": True, "example": 1},
                        "poster_css":  {"type": "string",  "example": "poster--1"},
                        "poster_icon": {"type": "string",  "example": "🌑"},
                        "description": {"type": "string",  "nullable": True, "example": "Mroczny detektyw tropi seryjnego zabójcę."},
                    },
                },
                "Category": {
                    "type": "object",
                    "properties": {
                        "id":    {"type": "integer", "example": 1},
                        "name":  {"type": "string",  "example": "Akcja"},
                        "icon":  {"type": "string",  "example": "💥"},
                        "color": {"type": "string",  "example": "#ef4444"},
                        "count": {"type": "integer", "example": 1240},
                    },
                },
                "PlanFeature": {
                    "type": "object",
                    "properties": {
                        "text":     {"type": "string",  "example": "Jakość HD (1080p)"},
                        "included": {"type": "boolean", "example": True},
                    },
                },
                "Plan": {
                    "type": "object",
                    "properties": {
                        "id":       {"type": "integer", "example": 2},
                        "name":     {"type": "string",  "example": "Standard"},
                        "price":    {"type": "integer", "example": 39},
                        "featured": {"type": "integer", "enum": [0, 1], "example": 1},
                        "features": {
                            "type": "array",
                            "items": {"$ref": "#/components/schemas/PlanFeature"},
                        },
                    },
                },
                "Stats": {
                    "type": "object",
                    "properties": {
                        "total_titles":     {"type": "integer", "example": 10000},
                        "quality":          {"type": "string",  "example": "4K"},
                        "profiles":         {"type": "integer", "example": 5},
                        "support":          {"type": "string",  "example": "24/7"},
                        "movies_in_db":     {"type": "integer", "example": 15},
                        "categories_count": {"type": "integer", "example": 6},
                        "average_rating":   {"type": "number",  "format": "float", "example": 8.2},
                    },
                },
                "Error": {
                    "type": "object",
                    "properties": {
                        "error": {"type": "string", "example": "Movie not found"}
                    },
                },
            },
            "responses": {
                "BadRequest":  {"description": "Bad request – invalid parameter",  "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                "NotFound":    {"description": "Resource not found",               "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
                "ServerError": {"description": "Internal server or database error", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}},
            },
        },
    }


# ── Swagger UI HTML ───────────────────────────────────────────────────────────
SWAGGER_UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StreamFlow API – Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css">
  <style>
    body { margin: 0; background: #0f172a; }
    .swagger-ui .topbar { background: #1e293b; }
    .swagger-ui .topbar .download-url-wrapper { display: flex; }
    .swagger-ui .info .title { color: #38bdf8; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout",
        deepLinking: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
      });
    };
  </script>
</body>
</html>"""


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
        if "features" in item and isinstance(item["features"], str):
            try:
                item["features"] = json.loads(item["features"])
            except Exception:
                pass
        result.append(item)
    return result


# ── Request handler ───────────────────────────────────────────────────────────
class StreamFlowHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"  [{self.address_string()}] {fmt % args}")

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

    def send_html(self, html: str, status=200):
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type",   "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        self.send_json({"error": message}, status)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/") or "/"
        params = parse_qs(parsed.query)

        if path.startswith("/api"):
            self.handle_api(path, params)
            return

        self.serve_static(path)

    def serve_static(self, path):
        if path == "/" or path == "":
            file_path = os.path.join(STATIC_DIR, "index.html")
        else:
            rel = path.lstrip("/")
            file_path = os.path.join(STATIC_DIR, rel)

        real_static = os.path.realpath(STATIC_DIR)
        real_file   = os.path.realpath(file_path)
        if not real_file.startswith(real_static):
            self.send_error_json(403, "Forbidden")
            return

        if not os.path.isfile(file_path):
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

    def handle_api(self, path, params):
        try:
            if path == "/api/movies":
                self.api_movies(params)
            elif path.startswith("/api/movies/"):
                movie_id = path.split("/")[-1]
                if movie_id.isdigit():
                    self.api_movie_detail(int(movie_id))
                else:
                    self.send_error_json(400, "Invalid movie ID")
            elif path == "/api/categories":
                self.api_categories()
            elif path == "/api/plans":
                self.api_plans()
            elif path == "/api/stats":
                self.api_stats()
            elif path == "/api/openapi.json":
                self.api_openapi()
            elif path in ("/api/docs", "/api/docs/"):
                self.api_swagger_ui()
            else:
                self.send_error_json(404, f"Endpoint '{path}' not found")
        except sqlite3.Error as e:
            self.send_error_json(500, f"Database error: {e}")
        except Exception as e:
            self.send_error_json(500, f"Server error: {e}")

    # ── /api/openapi.json ─────────────────────────────────────────────────────
    def api_openapi(self):
        host = self.headers.get("Host", f"localhost:{PORT}")
        spec = build_openapi_spec(host)
        self.send_json(spec)

    # ── /api/docs ─────────────────────────────────────────────────────────────
    def api_swagger_ui(self):
        self.send_html(SWAGGER_UI_HTML)

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

            self.send_json({"data": rows_to_list(rows), "total": len(rows)})
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
            self.send_json({"data": rows_to_list(rows), "total": len(rows)})
        finally:
            conn.close()

    # ── /api/plans ────────────────────────────────────────────────────────────
    def api_plans(self):
        conn = get_db()
        try:
            rows = conn.execute("SELECT * FROM plans ORDER BY price").fetchall()
            self.send_json({"data": rows_to_list(rows), "total": len(rows)})
        finally:
            conn.close()

    # ── /api/stats ────────────────────────────────────────────────────────────
    def api_stats(self):
        conn = get_db()
        try:
            total_movies     = conn.execute("SELECT COUNT(*) FROM movies").fetchone()[0]
            total_categories = conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
            avg_rating       = conn.execute("SELECT ROUND(AVG(rating),1) FROM movies").fetchone()[0]
            total_titles_sum = conn.execute("SELECT SUM(count) FROM categories").fetchone()[0]

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
║  Server:    http://localhost:{PORT:<26}              ║
║  Frontend:  http://localhost:{PORT}                  ║
╠══════════════════════════════════════════════════════╣
║  API Endpoints:                                      ║
║    GET /api/movies              all movies           ║
║    GET /api/movies?new=1        new releases         ║
║    GET /api/movies?q=query      search               ║
║    GET /api/movies/<id>         single movie         ║
║    GET /api/categories          categories           ║
║    GET /api/plans               pricing plans        ║
║    GET /api/stats               platform stats       ║
╠══════════════════════════════════════════════════════╣
║  Documentation:                                      ║
║    GET /api/docs                Swagger UI           ║
║    GET /api/openapi.json        OpenAPI 3.0 spec     ║
╠══════════════════════════════════════════════════════╣
║  Press Ctrl+C to stop                                ║
╚══════════════════════════════════════════════════════╝
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑  Server stopped.")
        server.server_close()