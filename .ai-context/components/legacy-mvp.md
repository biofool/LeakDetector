# Component: legacy-mvp — `legacy/`

**Status**: OBSERVED, runnable, frozen. Superseded by `docs/spec.md` — do not
extend; fix-forward means build the spec, not patch this (its known bugs are
deliberately fixed by rewrite — see `debt/register.yaml`).

## Files

| File | Role |
|------|------|
| `legacy/app/main.py` | FastAPI app + 8 routes + staff-token guard `_require_staff` |
| `legacy/app/db.py` | ALL persistence: `reports` table DDL, haversine `nearby_reports`, `zone_for_point` (pure-Python point-in-polygon over `data/council_zones.geojson`), `stats`, public serializer `_row_to_dict` |
| `legacy/app/notify.py` | `_smtp_config`, `notify_new_report`, `notify_status_change`, `_deliver` — SMTP send + unconditional audit-log append to `data/audit/notifications.log` |
| `legacy/app/__init__.py` | package marker |
| `legacy/static/index.html` | report form (mobile-first) |
| `legacy/static/map.html` | public status map |
| `legacy/static/report.js`, `style.css` | Leaflet + OSM via CDN, no build |
| `legacy/tests/test_api.py` | 7 pytest tests (API surface) |
| `legacy/requirements.txt` | fastapi, uvicorn, python-multipart, pytest |
| `legacy/.env.example` | env template (STAFF_TOKEN, SMTP_*) |

## Routes (main.py)

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/reports` | public | multipart: lat/lon/category/size/desc/contact/photos≤3 → 201 |
| `GET /api/reports` | public | `?status=` filter only; contact stripped |
| `GET /api/reports/nearby` | public | `?lat&lon&radius` (30 m default) — duplicate check |
| `GET /api/reports/{id}` | public | single report |
| `POST /api/reports/{id}/confirm` | public | "same leak" bump |
| `PATCH /api/reports/{id}` | `X-Staff-Token` | `?status=` transitions; duplicate link |
| `GET /api/stats` | public | totals, per-status, per-zone, median repair time |
| `GET /api/meta` | public | enums/meta for the form |

## Boundaries

- All SQL through `db.py` — the deliberate PostGIS swap seam.
- Public responses strip `reporter_*` contact fields (`_row_to_dict(public=True)`).
- Runtime state in `data/` (gitignored): `leakdetector.sqlite`, `uploads/`,
  `audit/notifications.log`.
- Status enum: `received → investigating → contractor_assigned → repaired /
  private_owner / duplicate / rejected`. Severity = `size` enum
  (trickle/steady/flowing/burst/unknown) — spec renames these; see
  `docs/spec-vs-mvp.md` naming table before trusting any enum.
