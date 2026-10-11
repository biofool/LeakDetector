# Architecture — LeakDetector

Monorepo per `docs/spec.md`. `backend/` is Express + TypeScript +
`pg` + PostGIS (migrations in `backend/migrations/`); `src/worker.ts` is a
separate process draining `notification_outbox` and running the SLA sweep.
`frontend/` is React + Vite + Tailwind PWA (routes `/`, `/map`, `/r/:id`,
`/staff`). Staff auth is JWT via `POST /api/v1/auth/login` (argon2id
hashes, 8 h tokens, council-scoped). `legacy/` holds the retired
FastAPI + SQLite MVP — reference only, do not extend it.

`docs/decisions.md` records every deviation from the original brief
(`docs/brief.md`); `docs/spec-vs-mvp.md` lists the gaps and open
decisions. Update these when the design or the code changes.

## Top-level layout
- `backend/`
- `data/`
- `deploy/`
- `docs/`
- `frontend/`
- `legacy/`
- `logs/`
- `scripts/`

**Key files:** `AGENTS.md`, `CLAUDE.md`, `LICENSE`, `README.md`, `TechnicalMarketingReadMe.md`, `docker-compose.yml`
