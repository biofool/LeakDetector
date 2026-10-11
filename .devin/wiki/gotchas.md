# Gotchas — LeakDetector

2026-10 security audit: workflow action pins + `persist-credentials: false`, non-root backend Dockerfile.

## Standing rules
- Never commit secrets (`.env`, `*.key`, `credentials*.json` are gitignored).
- Never read or log secret values — key names and lengths only.
- Security fixes land reviewed-but-uncommitted first, then roll dev → main.
