# Quickstart — biofool/LeakDetector

## System Shape

Two coexisting states — read this first:

- **`legacy/`** — working MVP, runnable today. FastAPI (Python) + stdlib
  `sqlite3` + no-build Leaflet frontend. Citizen leak reports, staff triage,
  duty-officer email, public map. Frozen for reference.
- **`backend/`** — target build in progress (untracked): TypeScript +
  Express + Postgres/PostGIS, worker, migrations, Jest. Being built to
  `docs/spec.md` §6 milestones.
- **`docs/spec.md`** — target design. Monorepo: `/backend` Node 20/Express +
  Postgres 16/PostGIS + a worker process; `/frontend` React + Vite +
  Tailwind PWA (not started). Railway deploy. Build contract: milestones
  M1–M11.

Do not extend `legacy/` — it is superseded. Do not assume `frontend/` or
spec entities exist in code yet.

## Run the MVP

```bash
cd legacy && pip3 install -r requirements.txt
STAFF_TOKEN=devtoken uvicorn app.main:app --host 0.0.0.0 --port 8080
```

(README still shows the pre-move root paths; the MVP now lives in `legacy/`.)

Report form `http://127.0.0.1:8080/` · map `/map.html` · API docs `/docs`.

Tests: `python3 -m pytest legacy/tests/ -q` (7 tests).

## Major Entry Points

- **`legacy/app/main.py`** — 8 routes: `POST/GET /api/reports`,
  `GET /api/reports/nearby`, `GET /api/reports/{id}`,
  `POST /api/reports/{id}/confirm`, `PATCH /api/reports/{id}` (staff),
  `GET /api/stats`, `GET /api/meta`
- **`legacy/app/db.py`** — ALL SQL lives here (stdlib sqlite3); single seam
  for the eventual PostGIS swap. Haversine duplicate search (~30 m default),
  point-in-polygon council-zone lookup over `data/council_zones.geojson`.
- **`legacy/app/notify.py`** — SMTP duty-officer email; always appends to
  `data/audit/notifications.log`; warns-not-fails when SMTP unconfigured.
- **`docs/README.md`** — the design doc reading order (brief → decisions →
  spec → spec-vs-mvp).

## Architectural Boundaries

- Staff endpoints gated by `X-Staff-Token` == env `STAFF_TOKEN`; reporter
  endpoints public. Public serializers strip `reporter_*` contact fields.
- Photos: `data/uploads/` (local disk in MVP; S3-compatible bucket in spec).
- `AGENTS.md` canonical global rules; `CLAUDE.md` mirrors them + holds the
  project section.

## Dependency Rules

- MVP: `fastapi`, `uvicorn`, `python-multipart`, `pytest` (see
  `legacy/requirements.txt`). No build step anywhere.
- Spec adds: Node 20, Express, zod, pg, multer, sharp, node-pg-migrate,
  React, Vite, Tailwind, vite-plugin-pwa.
- External services (spec only): Postgres+PostGIS, S3 bucket, Postmark/SES
  email, Twilio/NZ SMS gateway — none configured yet.
