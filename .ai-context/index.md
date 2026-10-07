# AI Context Index — biofool/starter

> **Revision**: `da39d5f` (2026-07-25 config version stamp)
> **Last analyzed**: 2026-08-22
> **Staleness check**: compare `git rev-parse HEAD` with revision above; if
> different, re-run Context Compiler on changed files.

## What This Repo Is

GitHub template repository (`biofool/starter`) providing shared AI coding
configuration for all biofool projects. Contains zero application code —
only Markdown rules, JSON config, gitignore, and Devin skills. Downstream
repos clone via `gh repo create <name> --template biofool/starter`.

**Classification**: OBSERVED — no deployable units, no runtime, no tests.

## Repository Shape

| Area | Files | Purpose |
|------|-------|---------|
| `AGENTS.md` | 1 | Canonical global rules for Devin CLI (10 rules + cloud strategy) |
| `CLAUDE.md` | 1 | Mirror of global conventions for Claude Code + project skeleton |
| `.claude/settings.json` | 1 | Empty permissions allowlist (build per-project) |
| `.devin/skills/` | 12 SKILL.md | Brave Search API skills (web, news, images, videos, etc.) |
| `.gitignore` | 1 | Python, Node, IDE, OS, secrets, Claude/Devin local files |
| `README.md` | 1 | Template usage instructions + after-clone checklist |
| `TechnicalMarketingReadMe.md` | 1 | Marketing summary of template features |

## Navigation Path

1. **New to this repo?** → `quickstart.md`
2. **Understand what downstream repos inherit** → `architecture/system-overview.md`
3. **Changing global rules?** → `workflows/template-sync.md` (critical: AGENTS.md ↔ CLAUDE.md mirror)
4. **Adding/removing a skill?** → `components/devin-skills.md`
5. **Cloud strategy changes?** → `AGENTS.md` §"Cloud strategy" + `workflows/cloud-strategy-sync.md`
6. **Conventions enforced by template** → `conventions/coding-patterns.md`
7. **What's unknown** → `unknowns/register.yaml`

## Key Artifacts

- `architecture/system-overview.md` — template-to-downstream data flow
- `components/agents-md.md` — canonical rules file (highest-traffic component)
- `components/claude-md.md` — mirror file (must stay in sync)
- `components/devin-skills.md` — 12 Brave Search skills
- `workflows/template-sync.md` — how downstream repos pull updates
- `change-impact/relationships.yaml` — dependency map for all components
- `conventions/coding-patterns.md` — the 10 global rules the template enforces

## Size & Scope

- 17 files, 0 LOC application code
- Languages: Markdown (docs/rules), JSON (config)
- No build system, no package manager, no CI/CD, no tests
- No databases, no queues, no external API calls (skills document API usage but contain no executable code)
