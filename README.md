# LeakDetector

Detects leaked credentials and secrets — API keys, tokens, private keys,
passwords — in git working trees, committed history, and config files.

## Status

Scaffolded from [biofool/starter](https://github.com/biofool/starter).
Implementation not started yet.

## What's included from the template

- `AGENTS.md` / `CLAUDE.md` — shared biofool AI-agent rules (versioned,
  synced from the template).
- `.githooks/pre-commit` — blocks commits containing known secret patterns
  (`scripts/scan_secrets.py` pattern set). Install with
  `git config core.hooksPath .githooks` or copy to `.git/hooks/`.
- `scripts/scan_secrets.py` — working-tree secret scanner with `--dry-run`
  and JSON audit output to `data/audit/`.
- `scripts/audit-deps.sh` + `.github/workflows/{dependency-review,dependency-audit,secret-scan}.yml`
  — the three-layer dependency/secret gating described in `AGENTS.md`.
- `.devin/skills/` — bundled skills incl. Brave Search (needs
  `BRAVE_SEARCH_API_KEY`) and ponytail.

## Repo conventions

- Default branch `main`; `dev` exists as the template's dev snapshot.
- Fix scripts go in `scripts/fix/` with `--dry-run`, `--limit`/`--offset`,
  audit JSON to `data/audit/`.
