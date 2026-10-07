# Architecture — biofool/LeakDetector

## Documents

- `system-overview.md` — system context, current-vs-target architecture, data flow

## Reading Order

1. `docs/brief.md` — what the product owner asked for (fixed historical record)
2. `docs/spec.md` — the target architecture (canonical going-forward design)
3. `docs/decisions.md` — why the spec departs from the brief (D-01–D-18)
4. `docs/spec-vs-mvp.md` — how `legacy/` code differs from the spec
5. `.ai-context/components/legacy-mvp.md` — the code that exists today

## The One-Sentence Version

A FastAPI/SQLite MVP proved the flow end-to-end; it is now frozen in
`legacy/` while the production design — Node/Express + PostGIS API, worker,
React PWA — is built fresh under `/backend` and `/frontend` to `docs/spec.md`.

## Key Invariants (both versions)

- Public reporters never need accounts; staff are authenticated and
  council-scoped.
- Reporter contact details never leave staff surfaces — public API responses
  strip `reporter_*` fields.
- Duplicate reports are linked, not merged; no chains (D-10).
- All notifications go through a durable outbox (spec) or an audit log
  (MVP) — never silent.
- Every spec↔brief deviation is a numbered `D-xx` in `docs/decisions.md`.
