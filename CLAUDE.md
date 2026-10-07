<!-- AI coding config version: 2026-10-07 — sourced from biofool/starter template.
     Shared settings across all biofool projects; see ~/.codeium/windsurf/memories/shared_template_config.md -->

# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

LeakDetector is a citizen water-leak reporting app for NZ councils — a
mobile-first web form where residents drop a pin, snap a photo, and report
leaks (footpath/berm/road/meter/outside tap) in under 30 seconds, with
duplicate detection, SLA timers, duty-officer email alerts, and a public
status map. Modelled on FixMyStreet / SeeClickFix / MAWC Citizen Leak
Reporter patterns.

## Environment

Linux (Ubuntu), bash. `gh` CLI authenticated as `biofool`.

## Commands

- Install: `cd backend && npm install` · `cd frontend && npm install`
- Dev: `cd backend && npm run migrate && npm run seed && npm run dev`
  (+ `npm run worker` for notifications); `cd frontend && npm run dev`
- Backend test: `cd backend && npm test` (Jest + supertest, needs a live
  PostGIS DB — `docker run -d -p 5433:5432 docker.io/postgis/postgis:16-3.5`)
- Frontend test: `cd frontend && npm test` (Vitest)
- PWA: http://127.0.0.1:5173/ · API: http://127.0.0.1:8080/api/v1

## Architecture

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

## Conventions

<!-- Anything non-obvious from reading the code: naming, error handling
     patterns, things that look like bugs but aren't. -->

## Global conventions (apply to every project)

The canonical home for cross-project rules is `AGENTS.md` (read by Devin).
The items below are mirrored here so Claude Code applies them too. If you
edit one, edit both.

- **Validation requests — do not change code.** When asked to validate or
  check a conclusion, investigate and report only. Do not start editing code
  unless the user explicitly asks for a fix or implementation.
- **Never read secrets files.** Do not read, cat, or print `.env`,
  `.env.secrets`, `*.key`, `credentials*.json`, `service-account*.json`, or
  any file containing API keys, tokens, or passwords. Ask the user to
  provide credentials directly or via environment variables.
- **Never commit or log secrets.** Keep `.gitignore` entries for `.env`,
  `*.key`, `*.pem`, `credentials.json`, `cookies.txt`. Treat
  infrastructure-touching scripts as production-sensitive; prefer dry-run
  flags.
- **API cost comparisons — be accurate and specific.** Verify pricing from
  official sources, distinguish per-call vs. subscription vs. tiered, compute
  break-even volume, separate marginal from total cost, account for free
  tiers, double-check arithmetic, state all assumptions.
- **Never fail silently.** Every exception or unavailable dependency must be
  logged at WARNING or ERROR with a specific message. No bare
  `except: pass` / `except: return`.
- **No backslash line continuations in shell commands shown to the user.**
  Long `gcloud`/`terraform`/`gsutil`/`kubectl` commands stay on one line.
- **One-off fix scripts** go in `scripts/fix/`, support `--dry-run`, write
  audit JSON to `data/audit/` (or `audit/`), and support `--limit`/`--offset`.
- **Prefer stored data files over hardcoding.** Never hardcode arrays or
  lookup tables with more than 15 items in source — read from a
  version-controlled JSON/YAML/TOML file instead.
- **Cross-repo coordination.** If this project is part of a paired repo
  system (e.g. frontend + backend with a shared auth flow), document the
  sister repo in `AGENTS.md` and require both PRDs + both repos to be
  updated and deployed together for shared-flow changes.
- **Cloud strategy — CloudManagement coordination.** CloudManagement
  (`biofool/CloudManagement`) is the canonical source for cloud strategy.
  When this repo adds/changes a cloud resource, data store, job placement,
  or paid API, update CloudManagement's inventory (`config/accounts.yaml`),
  PRD (`docs/PRD.md`), and this template's cloud-strategy section. Repos
  with paid APIs vendor the `cloud_management_client` (stdlib-only) and
  declare intent before API calls, report actuals after. Every report
  includes an `application` field (human-readable product name, e.g.
  `"OSenseiArchiver"`) distinct from `source_repo` (the GitHub repo).
  The client is best-effort (no-op without env vars, never breaks the
  host app). Long-running cloud jobs can also push `heartbeat` /
  `daily_report` operational reports (`client.submit_report`) — the hub
  emails them daily to `pipeline_report_email` and restarts stale
  reporter VMs via `keepalive:` config (issue #86). See `AGENTS.md` for
  the full section and
  `~/projects/CloudManagement/docs/per-repo-api-specs.md` for per-repo specs.
- **JEV bounded decisions.** `typesafe/jev-1.13` via OpenRouter Decisions is
  available for bounded classification/scoring/routing/verification, not
  generation. New uses start off/shadow-only with existing fallbacks and a
  labeled calibration set. Enabled calls report `openrouter` / `decisions` to
  CloudManagement; verify current pricing first. Security/routing/kill uses
  require explicit approval and JEV is never the sole kill authority.
- **Dependency vulnerability gating (SCA).** Dependabot alerts are advisory
  only — every repo needs the three-layer gate: PR-time
  `.github/workflows/dependency-review.yml` (`fail-on-severity: high`),
  scheduled `.github/workflows/dependency-audit.yml` running
  `scripts/audit-deps.sh` (fails + opens an issue on findings), and a deploy
  gate (`needs:` the audit job, or a `bash scripts/audit-deps.sh` preflight
  in `sync.sh`/`deploy.sh` that exits non-zero on findings). Private repos
  without GitHub Advanced Security can't use dependency-review-action — run
  `scripts/audit-deps.sh` as a PR check instead. Lockfiles are always
  committed; exceptions live in a dated allowlist file with an issue link.

- **Reply in Simplified Technical English (STE) — unless it hurts
  clarity.** Write chat replies in STE: short sentences, active voice, one
  instruction per sentence, consistent terminology, no unexplained jargon.
  If strict STE would create confusion or ambiguity, drop it and write
  whatever is briefest and clearest. Applies to chat output only — code,
  commit messages, and docs keep their normal style.

See `AGENTS.md` for the full text of each rule.
