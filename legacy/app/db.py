"""SQLite data layer for LeakDetector.

Swappable for Postgres/PostGIS later: all queries go through this module.
"""
import json
import math
import os
import sqlite3
import time
from pathlib import Path

DB_PATH = Path(os.environ.get("LEAK_DB_PATH", "data/leakdetector.sqlite"))
UPLOAD_DIR = Path(os.environ.get("LEAK_UPLOAD_DIR", "data/uploads"))
ZONES_PATH = Path(os.environ.get("LEAK_ZONES_PATH", "data/council_zones.geojson"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    category TEXT NOT NULL,
    size TEXT NOT NULL DEFAULT 'unknown',
    description TEXT NOT NULL DEFAULT '',
    photos TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'received',
    reporter_contact TEXT NOT NULL DEFAULT '',
    council_zone TEXT,
    sla_due_at INTEGER,
    confirmations INTEGER NOT NULL DEFAULT 0,
    duplicate_of TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
"""


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres."""
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _row_to_dict(row: sqlite3.Row, public: bool = True) -> dict:
    d = dict(row)
    d["photos"] = json.loads(d["photos"])
    if public:
        d.pop("reporter_contact", None)
    return d


def insert_report(report: dict) -> dict:
    now = int(time.time())
    report.setdefault("created_at", now)
    report["updated_at"] = now
    report["photos"] = json.dumps(report.get("photos", []))
    with connect() as conn:
        conn.execute(
            """INSERT INTO reports (id, lat, lon, category, size, description,
               photos, status, reporter_contact, council_zone, sla_due_at,
               confirmations, duplicate_of, created_at, updated_at)
               VALUES (:id, :lat, :lon, :category, :size, :description,
               :photos, :status, :reporter_contact, :council_zone, :sla_due_at,
               :confirmations, :duplicate_of, :created_at, :updated_at)""",
            report,
        )
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report["id"],)).fetchone()
    return _row_to_dict(row)


def get_report(report_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    return _row_to_dict(row) if row else None


def list_reports(status: str | None = None, limit: int = 500) -> list[dict]:
    q = "SELECT * FROM reports"
    args: list = []
    if status:
        q += " WHERE status = ?"
        args.append(status)
    q += " ORDER BY created_at DESC LIMIT ?"
    args.append(limit)
    with connect() as conn:
        return [_row_to_dict(r) for r in conn.execute(q, args)]


def nearby_reports(lat: float, lon: float, radius_m: float = 30.0) -> list[dict]:
    # ponytail: O(n) scan over open reports; fine until ~100k rows.
    # Upgrade path: PostGIS ST_DWithin or an R-tree index.
    open_statuses = ("received", "investigating", "contractor_assigned")
    placeholders = ",".join("?" * len(open_statuses))
    with connect() as conn:
        rows = conn.execute(
            f"SELECT * FROM reports WHERE status IN ({placeholders})", open_statuses
        ).fetchall()
    out = []
    for r in rows:
        d = _row_to_dict(r)
        d["distance_m"] = round(haversine_m(lat, lon, r["lat"], r["lon"]), 1)
        if d["distance_m"] <= radius_m:
            out.append(d)
    return sorted(out, key=lambda x: x["distance_m"])


def update_status(report_id: str, status: str, duplicate_of: str | None = None) -> dict | None:
    with connect() as conn:
        cur = conn.execute(
            "UPDATE reports SET status = ?, duplicate_of = ?, updated_at = ? WHERE id = ?",
            (status, duplicate_of, int(time.time()), report_id),
        )
        if cur.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    return _row_to_dict(row)


def add_confirmation(report_id: str) -> dict | None:
    with connect() as conn:
        cur = conn.execute(
            "UPDATE reports SET confirmations = confirmations + 1, updated_at = ? WHERE id = ?",
            (int(time.time()), report_id),
        )
        if cur.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    return _row_to_dict(row)


def stats() -> dict:
    with connect() as conn:
        by_status = {
            r["status"]: r["n"]
            for r in conn.execute("SELECT status, COUNT(*) AS n FROM reports GROUP BY status")
        }
        repaired = conn.execute(
            "SELECT created_at, updated_at FROM reports WHERE status = 'repaired'"
        ).fetchall()
        by_zone = {
            r["council_zone"] or "unassigned": r["n"]
            for r in conn.execute(
                "SELECT council_zone, COUNT(*) AS n FROM reports GROUP BY council_zone"
            )
        }
        confirmations = conn.execute("SELECT COALESCE(SUM(confirmations),0) AS c FROM reports").fetchone()["c"]
    repair_hours = [ (r["updated_at"] - r["created_at"]) / 3600 for r in repaired ]
    return {
        "total": sum(by_status.values()),
        "by_status": by_status,
        "by_zone": by_zone,
        "confirmations": confirmations,
        "median_repair_hours": round(sorted(repair_hours)[len(repair_hours)//2], 1) if repair_hours else None,
    }


def zone_for_point(lat: float, lon: float) -> str | None:
    """Point-in-polygon against council maintenance zones in a GeoJSON file.

    Zones file format: FeatureCollection, each feature with a `name`
    (or `zone`) property and Polygon/MultiPolygon geometry. Absent file
    means no zoning — returns None, does not fail.
    """
    if not ZONES_PATH.exists():
        return None
    try:
        fc = json.loads(ZONES_PATH.read_text())
    except (OSError, json.JSONDecodeError) as e:
        import logging
        logging.getLogger(__name__).warning("Could not load zones file %s: %s", ZONES_PATH, e)
        return None
    for feat in fc.get("features", []):
        geom = feat.get("geometry") or {}
        polys = geom.get("coordinates") or []
        if geom.get("type") == "Polygon":
            polys = [polys]
        if geom.get("type") not in ("Polygon", "MultiPolygon"):
            continue
        for poly in polys:
            if poly and _in_ring(lon, lat, poly[0]):
                props = feat.get("properties") or {}
                return props.get("name") or props.get("zone") or "unknown"
    return None


def _in_ring(x: float, y: float, ring: list) -> bool:
    """Ray-casting point-in-polygon (lon/lat ring, first element of polygon)."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside
