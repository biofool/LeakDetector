# Coding Patterns & Conventions — biofool/LeakDetector

## Sources

| Layer | File | Scope |
|-------|------|-------|
| Global rules | `AGENTS.md` (canonical) / `CLAUDE.md` (mirror) | all biofool repos |
| Design-doc protocol | `docs/README.md`, `docs/decisions.md` header | this repo |
| MVP code habits | `legacy/app/*` | reference only — frozen |
| Spec conventions | `docs/spec.md` §2–§6 | the `backend/`+`frontend/` build |

## Enforced global rules (enforcement → mechanism)

- Secrets: never read values / never commit → `.githooks/pre-commit` +
  `scripts/scan_secrets.py` + `.github/workflows/secret-scan.yml`
- Dependency vulnerabilities: 3-layer gate → `dependency-review.yml` (PR),
  `dependency-audit.yml` (scheduled `scripts/audit-deps.sh`), deploy
  preflight
- Never fail silently → notify.py's warn-and-log is the repo's canonical
  example; the spec's outbox `failed` state + ERROR log is the same rule
- Fix scripts → `scripts/fix/` + `--dry-run` + audit JSON in `data/audit/`
- Lockfiles always committed (relevant once `package-lock.json` exists in
  `backend/`)

## Design-doc protocol (repo-specific, binding)

- `docs/brief.md` is read-only history.
- Change the design → edit `docs/spec.md` **and** append `D-xx` to
  `docs/decisions.md` (next number, four fields, tag spec line `[D-xx]`,
  never renumber; reversals marked "Superseded by D-yy").
- Code catches up to spec → tick the gap in `docs/spec-vs-mvp.md`.

## Spec coding conventions (apply to `backend/`)

- All input validation through `zod` schemas.
- All SQL in services/`db.ts` — no inline SQL in routes.
- `ST_MakePoint(lng, lat)` — longitude first (spec's called-out bug risk).
- Distances in metres via `::geography` casts; zone lookup `ST_Covers`.
- Notifications only via `notification_outbox` rows — API never calls
  email/SMS providers directly.
- Public serializers must not emit `reporter_*` fields (D-12).
- Public IDs rendered `WL-000123` from bigint (D-14).
- Error envelope + rate limiting middleware already stubbed in
  `backend/src/middleware/`.
