"""LeakDetector API — citizen water-leak reporting for NZ councils.

Serves the reporting API plus the static PWA in static/.
Run: uvicorn app.main:app --host 0.0.0.0 --port 8080
"""
import logging
import os
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import db, notify

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

CATEGORIES = ["footpath", "berm", "road", "meter", "outside_tap", "other"]
SIZES = ["trickle", "steady", "flowing", "burst", "unknown"]
# Target response hours by reported size — surface leaks, not burst mains.
SLA_HOURS = {"burst": 12, "flowing": 24, "steady": 72, "trickle": 168, "unknown": 168}
STATUSES = [
    "received", "investigating", "contractor_assigned",
    "repaired", "private_owner", "duplicate", "rejected",
]
MAX_PHOTOS = 3
MAX_PHOTO_BYTES = 10 * 1024 * 1024
DEFAULT_DUP_RADIUS_M = 30.0

app = FastAPI(title="LeakDetector", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


def _require_staff(x_staff_token: str | None) -> None:
    expected = os.environ.get("STAFF_TOKEN")
    if not expected:
        log.warning("Staff endpoint called but STAFF_TOKEN is not configured")
        raise HTTPException(503, "staff endpoints not configured")
    if x_staff_token != expected:
        raise HTTPException(403, "invalid staff token")


@app.post("/api/reports", status_code=201)
async def create_report(
    lat: float = Form(...),
    lon: float = Form(...),
    category: str = Form(...),
    size: str = Form("unknown"),
    description: str = Form(""),
    reporter_contact: str = Form(""),
    photos: list[UploadFile] = File(default=[]),
):
    if not (-47.5 <= lat <= -33.8 and 165.5 <= lon <= 179.5):
        raise HTTPException(422, "location outside New Zealand bounds")
    if category not in CATEGORIES:
        raise HTTPException(422, f"category must be one of {CATEGORIES}")
    if size not in SIZES:
        raise HTTPException(422, f"size must be one of {SIZES}")

    report_id = uuid.uuid4().hex[:12]
    saved: list[str] = []
    for i, photo in enumerate(photos[:MAX_PHOTOS]):
        data = await photo.read()
        if len(data) > MAX_PHOTO_BYTES:
            raise HTTPException(413, f"photo {i+1} exceeds {MAX_PHOTO_BYTES} bytes")
        ext = Path(photo.filename or "").suffix.lower() or ".jpg"
        dest = db.UPLOAD_DIR / report_id / f"{i}{ext}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        saved.append(str(dest.relative_to(db.UPLOAD_DIR.parent)))

    duplicates = db.nearby_reports(lat, lon, DEFAULT_DUP_RADIUS_M)
    report = db.insert_report({
        "id": report_id,
        "lat": lat,
        "lon": lon,
        "category": category,
        "size": size,
        "description": description[:2000],
        "photos": saved,
        "status": "received",
        "reporter_contact": reporter_contact[:200],
        "council_zone": db.zone_for_point(lat, lon),
        "sla_due_at": int(time.time()) + SLA_HOURS[size] * 3600,
        "confirmations": 0,
        "duplicate_of": None,
    })
    notify.notify_new_report(report, base_url=os.environ.get("BASE_URL", ""))
    report["possible_duplicates"] = [d["id"] for d in duplicates]
    return report


@app.get("/api/reports")
def list_reports(status: str | None = None, limit: int = Query(500, le=2000)):
    if status and status not in STATUSES:
        raise HTTPException(422, f"status must be one of {STATUSES}")
    return db.list_reports(status=status, limit=limit)


@app.get("/api/reports/nearby")
def reports_nearby(lat: float, lon: float, radius: float = DEFAULT_DUP_RADIUS_M):
    return db.nearby_reports(lat, lon, min(radius, 500.0))


@app.get("/api/reports/{report_id}")
def get_report(report_id: str):
    report = db.get_report(report_id)
    if not report:
        raise HTTPException(404, "report not found")
    return report


@app.post("/api/reports/{report_id}/confirm")
def confirm_report(report_id: str):
    """Citizen 'me too' — bumps the confirmation count on an open report."""
    report = db.add_confirmation(report_id)
    if not report:
        raise HTTPException(404, "report not found")
    return report


@app.patch("/api/reports/{report_id}")
def patch_report(
    report_id: str,
    status: str,
    duplicate_of: str | None = None,
    x_staff_token: str | None = Header(None),
):
    _require_staff(x_staff_token)
    if status not in STATUSES:
        raise HTTPException(422, f"status must be one of {STATUSES}")
    report = db.update_status(report_id, status, duplicate_of)
    if not report:
        raise HTTPException(404, "report not found")
    contact = db.get_report(report_id).get("reporter_contact")
    if contact and "@" in contact:
        notify.notify_status_change(report, to_addr=contact)
    return report


@app.get("/api/stats")
def get_stats():
    return db.stats()


@app.get("/api/meta")
def get_meta():
    return {"categories": CATEGORIES, "sizes": SIZES, "statuses": STATUSES}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
