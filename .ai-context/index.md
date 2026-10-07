# AI Context Index — biofool/LeakDetector

> **Revision**: `0d2650f` (HEAD — "Add target-design spec docs; move FastAPI
> MVP to legacy/")
> **Last analyzed**: 2026-10-07
> **Staleness check**: compare `git rev-parse HEAD` with revision above; if
> different, re-run Context Compiler on changed files. **`backend/` is
> volatile** — the spec build was landing during this analysis.

## What This Repo Is

Citizen water-leak reporting app for NZ councils. A resident drops a pin,
snaps a photo, and reports a leak in under 30 s; staff triage with duplicate
detection, SLA timers, duty-officer email alerts, and a public status map.
Modelled on FixMyStreet / SeeClickFix / MAWC Citizen Leak Reporter.

**The repo is mid-pivot.** Three states coexist:

- **`legacy/`** (committed `0d2650f`) — the working MVP: FastAPI + stdlib
  `sqlite3` backend, no-build Leaflet frontend, 7 pytest tests. Runnable,
  frozen for reference — do not extend.
- **`docs/`** (committed `0d2650f`) — the target design pack: `spec.md`
  specifies a Node 20/Express + PostGIS `/backend` and React/Vite/Tailwind
  PWA `/frontend` monorepo (milestones M1–M11, spec §6). `decisions.md`
  (D-01–D-18) records every spec↔brief deviation; `spec-vs-mvp.md` lists
  the gaps.
- **`backend/`** (untracked, actively being written during this analysis) —
  the spec build in progress: TypeScript + Express + zod + pg + multer +
  sharp + JWT/argon2 + `@aws-sdk/client-s3`, `migrations/001_init.sql`,
  `services/{zones,photos,outbox,duplicates,sla}.ts`, `worker.ts`.
  `frontend/` does not exist yet.

**Classification**: OBSERVED (legacy/, backend/ code) + DECLARED (frontend,
deployment).

## Repository Shape

| Area | Files | Purpose |
|------|-------|---------|
| `legacy/app/` | 4 .py | FastAPI MVP: `main.py` (8 routes), `db.py` (sqlite3 + haversine + point-in-polygon), `notify.py` (SMTP + audit fallback) |
| `legacy/static/` | 4 | No-build frontend: report form, public map (Leaflet+OSM CDN) |
| `legacy/tests/` | 1 | `test_api.py` — 7 pytest tests |
| `backend/` | ~17 .ts | Spec build in progress (untracked): Express+TS API, worker, migrations, Jest |
| `docs/` | 5 | Design pack: brief → decisions → spec → spec-vs-mvp (+ README index) |
| `data/` | runtime | Gitignored: `leakdetector.sqlite`, `uploads/`, `audit/notifications.log` |
| `scripts/` | 2 | Template security tooling: `scan_secrets.py`, `audit-deps.sh` |
| `.githooks/`, `.github/workflows/` | 4 | Pre-commit secret scan; CI: secret-scan, dependency-review, dependency-audit |
| `AGENTS.md`, `CLAUDE.md` | 2 | biofool global agent rules (template-synced) + project section |
| `.devin/skills/` | ~100 | Bundled agent skills (Brave Search, ponytail, UI/UX suite, …) |

## Navigation Path

1. **New to this repo?** → `quickstart.md`
2. **Understand the MVP→spec pivot** → `architecture/system-overview.md` + `docs/spec-vs-mvp.md`
3. **Building the target design?** → `docs/spec.md` §6 (M1–M11 build order) + `workflows/spec-build.md`
4. **Touching MVP code in `legacy/`?** → `components/legacy-mvp.md` — frozen reference, not to be extended
5. **Changing design?** → update `docs/spec.md` **and** add a `D-xx` row in `docs/decisions.md` (never renumber)
6. **Conventions enforced** → `conventions/coding-patterns.md`
7. **Open questions needing a human** → `unknowns/register.yaml` (D-08, D-11, D-15)

## Key Artifacts

- `docs/spec.md` — canonical target design (the "where we are going")
- `docs/decisions.md` — D-01–D-18 decision log (the "why it differs")
- `docs/brief.md` — original product-owner request (historical record, do not edit)
- `legacy/app/main.py` — the running API as it exists today
- `backend/src/app.ts` — the new API under construction
