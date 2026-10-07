# System Overview — biofool/LeakDetector

## A. System Context

A civic-tech reporting product: NZ residents report water leaks (footpath /
berm / road / meter / outside tap) from a phone; council staff triage and
resolve under SLA timers.

```
 Reporter (phone)                                 Council staff
 / report form    /map public status board       /staff dashboard
      │  HTTPS (JSON, multipart)                      │  HTTPS + staff auth
      ▼                                               ▼
 ┌──────────────────────────────────────────────────────────┐     ┌────────────────┐
 │ API                                                       │────▶│ Photo storage  │
 │ validate → zone lookup → SLA → insert report + outbox     │     └────────────────┘
 └───────────────────────────┬──────────────────────────────┘
                             │ SQL
 ┌───────────────────────────▼──────────────────────────────┐
 │ DB: reports, photos, council zones, staff, outbox        │
 └───────────────────────────▲──────────────────────────────┘
                             │ poll outbox · SLA sweep
 ┌───────────────────────────┴──────────────────────────────┐     Email duty officer
 │ Worker                                                   │────▶ SMS if major
 └──────────────────────────────────────────────────────────┘     Reporter receipts
```

## B. Two Implementations

### Current (OBSERVED) — `legacy/` MVP

- **API**: FastAPI, `legacy/app/main.py` — 8 routes.
- **DB**: stdlib `sqlite3` via `legacy/app/db.py` — one `reports` table;
  haversine for nearby-duplicates (~30 m default); pure-Python
  point-in-polygon over `data/council_zones.geojson` (optional — absent =
  unassigned).
- **Photos**: `data/uploads/` on local disk.
- **Notify**: `legacy/app/notify.py` — SMTP to duty officer; ALWAYS writes
  `data/audit/notifications.log`; warns-not-fails unconfigured.
- **Auth**: `X-Staff-Token` header == env `STAFF_TOKEN` on staff routes only.
- **Frontend**: `legacy/static/` — Leaflet + OSM via CDN, no build.
- **Tests**: `legacy/tests/test_api.py` — 7 pytest tests.

### Target (DECLARED + in-progress) — `docs/spec.md`, `backend/`

- **`/backend`**: Node 20 + TypeScript + Express; zod validation; `pg` →
  Postgres 16 + PostGIS (`geometry(Point,4326)`, `ST_Covers` zone lookup,
  `ST_DWithin` 30 m dup search, `ST_MakePoint(lng,lat)` — lon first);
  `multer` → `sharp` (≤2 MB, webp, EXIF strip) → S3-compatible bucket;
  JWT staff auth (argon2), council-scoped.
- **`worker`** (same package, `npm run worker`): drains
  `notification_outbox` every 30 s (`FOR UPDATE SKIP LOCKED`, 5 retries);
  SLA sweep every 5 min (dedupe_key); resolution cascade to duplicates.
- **`/frontend`**: React + Vite + Tailwind PWA (`vite-plugin-pwa`) —
  report flow `/`, track page, public map `/map`, staff dashboard `/staff`
  (30 s polling, sorted by `sla_due_at`). NOT STARTED.
- **Deploy**: Railway — services `web`/`api`/`worker` + Postgres plugin;
  envs production+staging; `npm run migrate` pre-deploy on `api`.
- **Data residency [D-15]**: Railway has no NZ region — reporter contact
  details are personal info under Privacy Act 2020 (IPP 12); needs council
  sign-off.

## C. Report Lifecycle (spec §1.4)

Locate → duplicate check (`GET /reports/nearby`) → submit
(`POST /reports`, multipart ≤3 photos) → zone lookup (422 if outside every
zone, D-11) → `computeSLA(severity, location_type)` → single-transaction
insert (report + photos + outbox rows) → worker alerts → staff triage
(sorted by `sla_due_at`) → SLA sweep → resolve (cascades to duplicates) →
resolved shown on public map for 7 days.

## D. Status Enums

- **MVP**: `received → investigating → contractor_assigned → repaired /
  private_owner / duplicate / rejected`; severity is `size`:
  trickle/steady/flowing/burst/unknown.
- **Spec**: `received → verified → assigned → resolved` +
  `closed_private`; severity `major`/`minor`; `category` (reporter-set,
  immutable) vs `location_type` (staff-corrected, drives SLA) — one shared
  enum (D-02).
