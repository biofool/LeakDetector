# Component: backend-build — `backend/`

**Status**: OBSERVED-in-progress. Untracked, being written during the
2026-10-07 session — treat the file list as a snapshot. Built to
`docs/spec.md` §6 milestones M1–M7+ (backend portion).

## Shape

| File | Role (per spec) |
|------|-----------------|
| `backend/package.json` | `leakdetector-backend`; scripts: `dev` (tsx watch), `build` (tsc), `start`, `worker`, `migrate`, `seed`, `test` (jest, ESM) |
| `backend/tsconfig.json`, `jest.config.cjs` | TypeScript + Jest toolchain |
| `backend/migrations/001_init.sql` | PostGIS schema (spec §2) |
| `backend/src/index.ts`, `app.ts` | Express entry/app wiring |
| `backend/src/config.ts`, `db.ts`, `types.ts`, `migrate.ts` | Config, `pg` pool, types, migration runner |
| `backend/src/routes/{reports,auth}.ts` | Reports API + `POST /auth/login` (JWT) |
| `backend/src/middleware/{staffAuth,errors,rateLimit}.ts` | JWT/council scoping, error envelope, rate limits |
| `backend/src/services/{zones,photos,outbox,duplicates,sla}.ts` | ST_Covers zone lookup; multer→sharp→S3; outbox writes; duplicate logic; SLA matrix |
| `backend/src/util/{ref,serialize}.ts` | `WL-000123` refs; public serializer (strips reporter fields) |
| `backend/src/worker.ts` | outbox drain 30 s + SLA sweep 5 min + resolution cascade |
| `backend/scripts/seed.ts` | seed councils/zones for dev |
| `backend/.env.example` | `DATABASE_URL`, `JWT_SECRET`, `S3_*`, mail/SMS tokens |

## Dependencies (package.json)

express, zod, pg, multer, sharp, jsonwebtoken, argon2, cors,
@aws-sdk/client-s3 (+ tsx, typescript, jest as dev).

## Not yet present

- `frontend/` (React/Vite/Tailwind PWA — spec milestones M8–M10)
- `docker-compose.yml` for local Postgres+PostGIS (spec §6 local setup)
- Tests for the new backend (Jest configured; spec M2/M3 acceptance checks
  define them)
