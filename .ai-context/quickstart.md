# Quickstart — biofool/starter

## System Shape

GitHub template repo. Zero code. Provides shared AI agent config (rules,
skills, gitignore, settings) that downstream biofool repos inherit on clone.
Not a deployable system — a configuration distribution mechanism.

## Major Entry Points

- **`AGENTS.md`** — Devin CLI reads this as native rules; canonical source of 10 global rules + cloud strategy
- **`CLAUDE.md`** — Claude Code reads this; mirrors global conventions from AGENTS.md
- **`.devin/skills/*/SKILL.md`** — Devin skill definitions for Brave Search API (12 skills)

## Architectural Boundaries

- `AGENTS.md` is **canonical**; `CLAUDE.md` mirrors it — edit AGENTS.md first
- Global rules (shared across all projects) vs. project-specific guidance (filled in after clone)
- `.devin/config.local.json` is gitignored — per-project, not shared
- `.claude/settings.local.json` is gitignored — per-project, not shared

## Dependency Rules

- No code dependencies (no package.json, requirements.txt, pyproject.toml)
- Skills require `BRAVE_SEARCH_API_KEY` env var for live API calls (DECLARED in SKILL.md files)
- Cloud strategy section references external repo `biofool/CloudManagement`

## Coding Patterns (Enforced by Template)

1. Never read/commit/log secrets  2. Never fail silently  3. No backslash line continuations
4. Fix scripts in `scripts/fix/` with `--dry-run`  5. Stored data files over hardcoding (>15 items)
6. Accurate API cost comparisons  7. Validation requests = report only  8. Cross-repo coordination
9. Executive summaries for monorepos  10. CloudManagement coordination for cloud changes

## Essential Commands

```bash
gh repo create <name> --template biofool/starter --private --clone   # create new repo from template
curl -s https://raw.githubusercontent.com/biofool/starter/main/AGENTS.md  # fetch latest for sync
```

No build, test, or lint commands exist — this is a documentation/config template.

## Highest-Risk Areas

1. **AGENTS.md ↔ CLAUDE.md desync** — if rules diverge, Devin and Claude Code behave differently
2. **Cloud strategy staleness** — references external CloudManagement repo; must stay current
3. **Skill API key exposure** — skills document Brave API usage; key must not be committed

## Navigation

→ `index.md` for full routing → `architecture/system-overview.md` for data flow
→ `workflows/template-sync.md` for sync process → `conventions/coding-patterns.md` for rules
