# backend — Express + PostGIS API

Implements `docs/spec.md` §3 at `/api/v1`. Node 20+, TypeScript, ESM.

## Setup

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL at minimum

# local Postgres+PostGIS via docker:
docker run -d --name leakdetector-postgis \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=leakdetector \
  -p 5433:5432 docker.io/postgis/postgis:16-3.5

npm run migrate             # applies migrations/*.sql
npm run seed                # demo council + zone + staff@example.govt.nz / password123
npm run dev                 # api on :8080
npm run worker              # outbox drain + SLA sweep (separate process)
```

## Tests

Need a live PostGIS DB (the docker container above works — tests use a
separate `leakdetector_test` database, created fresh each run):

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/leakdetector npm test
```

## Endpoints (`/api/v1`)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/login` | public | email+password → 8 h JWT |
| `POST /reports` | public | multipart report (≤3 photos, 8 MB each) |
| `GET /reports/nearby` | public | duplicate check (ST_DWithin, 30 m default) |
| `GET /reports/:id` | public | single report (staff token adds private fields) |
| `POST /reports/:id/confirm` | public | "I've seen it too" |
| `PATCH /reports/:id` | staff JWT | status/verify/duplicate/severity/note |
| `GET /reports` | public/staff | filters: status, category, severity, zone, sla, bbox, updated_since, geojson |

## Layout

`src/config.ts` env · `db.ts` pool · `migrate.ts` migration runner ·
`app.ts`/`index.ts` express app + listen · `worker.ts` outbox/SLA ·
`routes/` auth + reports · `services/` sla, zones, duplicates, photos, outbox ·
`middleware/` staffAuth (JWT), rateLimit, errors · `util/` ref + serialize.

## Gotchas

- `ST_MakePoint(lng, lat)` — longitude first (spec §2).
- Distance queries must cast `geom::geography` or the index is missed.
- No S3_* → photos land in `data/uploads/` on local disk (ephemeral on Railway).
- `DISABLE_RATE_LIMIT=1` disables the limiter (used by tests only).
