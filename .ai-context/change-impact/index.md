# Change Impact — biofool/LeakDetector

`relationships.yaml` maps what touches what. Highest-fan-in surfaces:

1. **`docs/spec.md`** — every backend file implements it; changing it
   without a `D-xx` decision row breaks the repo's own protocol.
2. **`backend/migrations/001_init.sql`** — schema is the contract for
   routes, services, worker, and (later) the frontend's expectations.
3. **`backend/src/util/serialize.ts`** — the public/staff field split;
   mistakes here leak reporter contact details (privacy boundary, D-12).
4. **`legacy/app/db.py`** — frozen; changes have no path to production
   anyway, but tests in `legacy/tests/` pin its behaviour.
5. **`AGENTS.md`** global block — template-synced; edits get overwritten
   on the next template sync. Project notes belong in `CLAUDE.md`.
