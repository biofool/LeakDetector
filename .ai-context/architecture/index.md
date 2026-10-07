# Architecture Index

## Files

- `system-overview.md` — template-to-downstream data flow, trust boundaries, what gets inherited

## Deployable Units

None. This is a GitHub template repository with 0 LOC of application code.
No services, no frontends, no APIs, no databases, no workers, no CI/CD.

## Components (see `../components/`)

| Component | File | Role |
|-----------|------|------|
| AGENTS.md | `AGENTS.md` | Canonical global rules (Devin CLI) |
| CLAUDE.md | `CLAUDE.md` | Mirror of global conventions (Claude Code) |
| Devin Skills | `.devin/skills/*/SKILL.md` | 12 Brave Search API skill definitions |
| .gitignore | `.gitignore` | Secrets + cruft prevention policy |
| Claude settings | `.claude/settings.json` | Empty permissions allowlist scaffold |
