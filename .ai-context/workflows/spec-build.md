# Workflow: spec build (M1–M11)

The contract for turning `docs/spec.md` into code.

## Sequence (spec §6.6)

| # | Milestone | Done when |
|---|-----------|-----------|
| M1 | Backend skeleton: config, db, migration 001, seed, `GET /healthz` | `npm run migrate` on empty DB; `/healthz` → `200 {"db":"ok"}` |
| M2 | `sla.js` + unit tests | every §4 matrix cell + due_soon/breached boundaries tested |
| M3 | `POST /reports` (no photos), zone lookup, `GET /reports/:id` | in-zone → 201; out-of-zone → 422; public GET has no `reporter_*` |
| M4 | `GET /reports/nearby`, `POST /reports/:id/confirm` | 20 m found / 40 m not; confirm on resolved → 409 |
| M5 | Photos: multer → sharp → S3 | JPEG back as webp, no EXIF; 4th file → 400 |
| M6 | `POST /auth/login`, auth middleware, `PATCH`, `GET` filters | every transition allowed/refused tested; cross-council → 403 |
| M7 | Outbox + worker + SLA sweep | major report → 1 email + 1 SMS row/zone recipient; sweep idempotent; provider failure → `failed` after 5 |
| M8 | Frontend report flow (pin → dup sheet → form → success) | works at 360 px; "Yes, that's it" ends via confirm |
| M9 | Track page + public map | open + 7-day resolved shown; no personal data in responses |
| M10 | Staff dashboard | sorted by `sla_due_at`; 30 s polling; SLA + dup badges; PATCH actions |
| M11 | Railway deploy (staging → production) | pre-deploy migrate runs; real report on staging → real email |

## Local setup (spec §6)

`docker compose up -d` (Postgres+PostGIS) → `cd backend && cp .env.example
.env && npm i && npm run migrate && npm run seed && npm run dev` → second
shell `cd frontend && cp .env.example .env && npm i && npm run dev`.

## Rules while building

- Spec is the contract — where `legacy/` and spec disagree, spec wins and
  the difference is already in `docs/spec-vs-mvp.md`.
- Every spec↔brief deviation needs a `D-xx` in `docs/decisions.md`.
- Commit `package-lock.json` — dependency-review gate requires it.
- `backend/.env` is gitignored; `.env.example` takes placeholders only.
- Tick gaps in `docs/spec-vs-mvp.md` as milestones close them.
