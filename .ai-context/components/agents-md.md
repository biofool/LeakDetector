# Component: `AGENTS.md`

**Status**: OBSERVED — shared biofool global rules, synced from
`biofool/starter` (version stamp `2026-10-07` in the header comment).

## Role in this repo

Canonical rules file read by Devin CLI. Contents are ~100% the shared
template block — the project-specific guidance lives in `CLAUDE.md` /
`README.md` / `docs/` for this repo (the inverse of repos like AikiField
that append a "Project-specific" section inside AGENTS.md).

## What it enforces here

- Validation requests → investigate + report only, no edits
- Secrets: never read values (names/lengths only), never commit — backed by
  `.githooks/pre-commit`, `scripts/scan_secrets.py`,
  `.github/workflows/secret-scan.yml`
- Three-layer dependency gate: PR `dependency-review`, scheduled
  `dependency-audit`, deploy preflight `scripts/audit-deps.sh`
- CloudManagement coordination on cloud resource/paid-API changes —
  relevant when the Railway deploy + Postmark/SES/Twilio/S3 from spec.md
  are actually provisioned
- Fix-script conventions (`scripts/fix/`, `--dry-run`, audit JSON to
  `data/audit/`), STE chat replies, no backslash continuations

## Sync rule

Global sections are template-synced — don't fork them here; changes to
shared rules go upstream to `biofool/starter` (see
`workflows/template-sync.md`).
