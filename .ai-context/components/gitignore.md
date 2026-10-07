# Component: `.gitignore`

**Status**: OBSERVED — template gitignore, correct for this repo's needs.

## What it covers

- **Secrets**: `.env`, `.env.secrets`, `.env.local`, `*.key`, `*.pem`,
  `credentials*.json`, `cookies.txt` — keep these entries; the pre-commit
  hook assumes them
- **Runtime data**: `data/` contents (the MVP's `leakdetector.sqlite`,
  `uploads/` photos, `audit/notifications.log` all stay local;
  `data/.gitkeep` is tracked to keep the dir)
- **Node** (matters once `backend/`+`frontend/` land): `node_modules/`,
  `dist/`, build outputs
- **Python**: `__pycache__/`, `.pytest_cache/`, venvs
- **OS/IDE cruft**, Claude/Devin local files (`.claude/settings.local.json`,
  `.devin/config.local.json`)

## Watch out

- `backend/node_modules/` is untracked-but-present now (npm install ran
  in-tree). Confirm `node_modules/` is ignored before any `git add -A` —
  ~10k files.
- `backend/.env.example` is a template — git-tracked by design; keep only
  placeholders in it (see AGENTS.md secret-value rules).
