# Workflow: template sync

This repo was cloned from `biofool/starter`. The shared block of
`AGENTS.md`/`CLAUDE.md` + `.devin/skills/` + `.githooks/` +
`scripts/scan_secrets.py` + `scripts/audit-deps.sh` +
`.github/workflows/{secret-scan,dependency-review,dependency-audit}.yml`
is template-owned.

## Rules

- Global rules are synced **from** the template; don't edit them here —
  push changes upstream to `biofool/starter` and re-sync.
- Version stamp lives in the header comment of `AGENTS.md`/`CLAUDE.md`
  (`AI coding config version: YYYY-MM-DD`). Current: 2026-10-07.
- Project-specific guidance goes in `CLAUDE.md`'s project sections and
  `docs/` — not inside the global block.

## How to sync (manual)

```bash
curl -s https://raw.githubusercontent.com/biofool/starter/main/AGENTS.md
# merge the global-rules block into AGENTS.md + CLAUDE.md mirror,
# bump the version-stamp date
```

See `~/.codeium/windsurf/memories/shared_template_config.md` for the
project list and the full convention.
