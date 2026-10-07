# LeakDetector

Citizen water-leak reporting for NZ councils — mobile-first web form,
duplicate detection, SLA timers, duty-officer alerts, public status map.
Modelled on FixMyStreet / SeeClickFix / MAWC Citizen Leak Reporter.

## Quick start

```bash
pip3 install -r requirements.txt
STAFF_TOKEN=devtoken uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Report form: http://127.0.0.1:8080/ — public map: http://127.0.0.1:8080/map.html — API docs: http://127.0.0.1:8080/docs

Config via env vars — see `.env.example`. Optional council-zone assignment:
drop a GeoJSON FeatureCollection of maintenance zones at
`data/council_zones.geojson` (each feature needs a `name` or `zone` property).

## Design docs

The code here is a FastAPI + SQLite **MVP prototype**. The target design is a
Node/Express + PostGIS `/backend` and React + Vite + Tailwind `/frontend`
monorepo — start at [`docs/README.md`](docs/README.md):
[`spec.md`](docs/spec.md) (target design and build guide),
[`decisions.md`](docs/decisions.md) (where the spec departs from the brief),
[`spec-vs-mvp.md`](docs/spec-vs-mvp.md) (gap between this code and the spec).

## API (MVP)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/reports` | public | Submit a leak (multipart: lat/lon/category/size/desc/contact/photos≤3) |
| `GET /api/reports?status=` | public | List reports (contact stripped) |
| `GET /api/reports/nearby?lat&lon&radius` | public | Duplicate check (default 30 m) |
| `POST /api/reports/{id}/confirm` | public | "Same leak" — bumps confirmations |
| `PATCH /api/reports/{id}?status=` | `X-Staff-Token` | Advance status (received → investigating → contractor_assigned → repaired / private_owner / duplicate / rejected) |
| `GET /api/stats` | public | Totals, per-status, per-zone, median repair time |

## Stack & layout

FastAPI + SQLite (stdlib `sqlite3`, swappable for PostGIS) + no-build
Leaflet frontend. `app/` backend, `static/` web, `tests/` pytest,
`data/` runtime state (gitignored except `.gitkeep`).

## What's included from the template

- `AGENTS.md` / `CLAUDE.md` — shared biofool AI-agent rules (versioned,
  synced from the template).
- `.githooks/pre-commit` — blocks commits containing known secret patterns
  (`scripts/scan_secrets.py` pattern set). Install with
  `git config core.hooksPath .githooks` or copy to `.git/hooks/`.
- `scripts/scan_secrets.py` — working-tree secret scanner with `--dry-run`
  and JSON audit output to `data/audit/`.
- `scripts/audit-deps.sh` + `.github/workflows/{dependency-review,dependency-audit,secret-scan}.yml`
  — the three-layer dependency/secret gating described in `AGENTS.md`.
- `.devin/skills/` — bundled skills incl. Brave Search (needs
  `BRAVE_SEARCH_API_KEY`) and ponytail.

## Repo conventions

- Default branch `main`; `dev` exists as the template's dev snapshot.
- Fix scripts go in `scripts/fix/` with `--dry-run`, `--limit`/`--offset`,
  audit JSON to `data/audit/`.
