# File-Size Audit — `dev` branch

Method: `git ls-files | wc -l`, excluding `.ai-context/`, `node_modules/`,
`vendor/`, `dist/`, generated files, `data/`, lockfiles, and `legacy/`
(frozen MVP). `.devin/skills/` is vendored template cargo (DEBT-006) —
excluded from source audit; several of its files exceed 400 lines but are
not maintained as project source.

Threshold per `conventions/coding-patterns.md` → "File size &
responsibility": 400 lines = review trigger, not a law.

## Result

Only **2 project source files** exceed 400 lines:

| File | Lines | Responsibilities | AI-edit risk | Priority | Suggested split |
|------|-------|------------------|--------------|----------|-----------------|
| backend/src/routes/reports.ts | 619 | 7 route handlers (POST /, GET /nearby, GET /:id, PATCH photos, POST confirm, PATCH /:id, GET /) + E.164 normaliser | Medium-High — every endpoint change touches this file | MED | Keep one router, split handlers: `routes/reports/create.ts`, `read.ts`, `staff.ts`; shared helpers (E.164 norm, serializers) to `routes/reports/helpers.ts` |
| frontend/src/i18n/messages.ts | 541 | 1 — `en` + `mi` message dictionaries (data-like, generated feel) | Low — append-only edits, type-checked | LOW | Optional: split per language `messages/en.ts`, `messages/mi.ts` when a third language arrives |

## Out-of-scope but noted

- `docs/spec.md` (660 lines) — document, not source; already structured.
- `.devin/skills/` — ~14 files >400 lines (csv data, SKILL.md, vendored
  scripts). Not project source; covered by DEBT-006 (template cargo).

## Verdict

The codebase is healthy on file size. The single actionable item is
`reports.ts` splitting handler groups when it next needs concurrent edits.
