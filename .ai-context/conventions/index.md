# Conventions — biofool/LeakDetector

- `coding-patterns.md` — the enforced rules and where they come from

## Layers

1. **biofool global rules** (`AGENTS.md`, mirrored in `CLAUDE.md`) —
   secrets handling, fail-loudly, fix-script conventions, stored-data-over-
   hardcoding, SCA gate, STE chat style.
2. **Design-doc discipline** (`docs/README.md`) — brief is immutable;
   spec changes need a `D-xx` decision row; spec-vs-mvp gap list is
   ticked off as code catches up.
3. **MVP code habits** (`legacy/`): all SQL in `db.py`, public serializers
   strip contact fields, notify always audit-logs, warn-not-fail on
   unconfigured SMTP.
4. **Spec conventions for the new build**: zod validation at boundaries,
   outbox-only notifications, `ST_MakePoint(lng, lat)` ordering,
   council-scoped staff access, WL-padded public refs.
