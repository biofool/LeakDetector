# LeakDetector

Citizen water-leak reporting for NZ councils — mobile-first PWA, duplicate
detection, SLA timers, council alerts, public status map.
Modelled on FixMyStreet / SeeClickFix / MAWC Citizen Leak Reporter.

## Layout

| Path | What |
|---|---|
| `backend/` | Node + Express + Postgres/PostGIS API, `/api/v1` |
| `frontend/` | React + Vite + Tailwind PWA |
| `docs/` | `spec.md` (design + API), `decisions.md`, `brief.md`, `spec-vs-mvp.md` |
| `legacy/` | Original FastAPI + SQLite MVP (reference only) |

## Quick start

```bash
# 1. Postgres + PostGIS
docker run -d --name leakdetector-postgis \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=leakdetector \
  -p 5433:5432 docker.io/postgis/postgis:16-3.5

# 2. API on :8080
cd backend && npm install && cp .env.example .env
npm run migrate && npm run seed && npm run dev

# 3. Worker (notifications + SLA sweep) — second terminal
cd backend && npm run worker

# 4. PWA on :5173 — third terminal
cd frontend && npm install && cp .env.example .env && npm run dev
```

Report form: http://127.0.0.1:5173/ — map: http://127.0.0.1:5173/map —
staff: http://127.0.0.1:5173/staff (seed login `staff@example.govt.nz` / `password123`)

## Design docs

Start at [`docs/README.md`](docs/README.md): [`spec.md`](docs/spec.md) is the
implementation contract, [`decisions.md`](docs/decisions.md) records every
deviation from the original [`brief.md`](docs/brief.md), and
[`spec-vs-mvp.md`](docs/spec-vs-mvp.md) lists what changed versus the legacy MVP.

## Tests

```bash
cd backend && npm test    # Jest + supertest against a fresh PostGIS test DB
cd frontend && npm test   # Vitest
```

## Deploy notes — Railway

One Railway project; services `api`, `worker`, `web` + a Postgres plugin with
PostGIS enabled (`CREATE EXTENSION postgis` — run once, or let `npm run migrate`
do it; `001_init.sql` includes it).

- `api` — root dir `backend/`, build `npm run build`, pre-deploy
  `npm run start:migrate`, start `npm start`.
- `worker` — root dir `backend/`, build `npm run build`, start `npm run start:worker`.
- `web` — root dir `frontend/`, build `npm run build`, serve `dist/`
  (static). Set `VITE_API_BASE_URL` at build time.
- Env vars per service: `DATABASE_URL`, `JWT_SECRET`, `PUBLIC_BASE_URL`,
  `API_PUBLIC_URL` (this api's own public origin — photo URLs are absolute),
  `POSTMARK_*`/`TWILIO_*` for delivery, `S3_*` for photo storage
  (no bucket → local disk, which does not survive redeploys).

**Data residency:** Railway has no NZ region. Reporter contact details are
personal information under the Privacy Act 2020 (IPP 12) — confirm partner
councils accept offshore storage before go-live [D-15].

## Repo conventions

- Default branch `main`; `dev` exists as the template's dev snapshot.
- Fix scripts go in `scripts/fix/` with `--dry-run`, audit JSON to `data/audit/`.
- `scripts/scan_secrets.py` + `.githooks/pre-commit` guard against secrets.
