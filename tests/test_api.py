"""API smoke tests — run: python3 -m pytest tests/ -q"""
import os
import sys
import tempfile
from pathlib import Path

os.environ["LEAK_DB_PATH"] = str(Path(tempfile.mkdtemp()) / "test.sqlite")
os.environ["LEAK_UPLOAD_DIR"] = str(Path(tempfile.mkdtemp()) / "uploads")
os.environ["LEAK_AUDIT_DIR"] = str(Path(tempfile.mkdtemp()) / "audit")
os.environ["STAFF_TOKEN"] = "test-staff-token"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)

WELLINGTON = {"lat": -41.2865, "lon": 174.7762}


def make_report(**kw):
    payload = {"category": "footpath", "size": "steady", **WELLINGTON, **kw}
    r = client.post("/api/reports", data=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_and_get_report():
    rep = make_report(description="water pooling by the kerb")
    assert rep["status"] == "received"
    assert rep["sla_due_at"] > rep["created_at"]
    got = client.get(f"/api/reports/{rep['id']}").json()
    assert got["category"] == "footpath"
    assert "reporter_contact" not in got  # public view strips contact


def test_rejects_out_of_bounds():
    r = client.post("/api/reports", data={"lat": 51.5, "lon": -0.12, "category": "road"})
    assert r.status_code == 422


def test_rejects_bad_category():
    r = client.post("/api/reports", data={**WELLINGTON, "category": "nonsense"})
    assert r.status_code == 422


def test_nearby_duplicate_detection():
    rep = make_report()
    near = client.get(
        f"/api/reports/nearby?lat={WELLINGTON['lat']}&lon={WELLINGTON['lon']}&radius=50"
    ).json()
    assert any(d["id"] == rep["id"] for d in near)
    far = client.get("/api/reports/nearby?lat=-36.85&lon=174.76&radius=30").json()
    assert all(d["id"] != rep["id"] for d in far)


def test_confirm_report():
    rep = make_report()
    r = client.post(f"/api/reports/{rep['id']}/confirm")
    assert r.json()["confirmations"] == 1


def test_status_lifecycle_requires_staff_token():
    rep = make_report()
    assert client.patch(f"/api/reports/{rep['id']}?status=investigating").status_code == 403
    r = client.patch(
        f"/api/reports/{rep['id']}?status=investigating",
        headers={"X-Staff-Token": "test-staff-token"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "investigating"


def test_stats_shape():
    make_report()
    s = client.get("/api/stats").json()
    assert s["total"] >= 1
    assert "received" in s["by_status"]
