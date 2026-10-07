# Coding Patterns & Conventions

## Source

All conventions are defined in `AGENTS.md` (canonical) and mirrored in
`CLAUDE.md` §"Global conventions". These are **enforced by template** —
downstream repos inherit them on clone.

## The 10 Global Rules

| # | Rule | Strength | Enforcement |
|---|------|----------|-------------|
| 1 | Validation requests — do not change code | Documented convention | Agent reads AGENTS.md/CLAUDE.md |
| 2 | Never read secrets files | Documented convention | Agent reads AGENTS.md/CLAUDE.md |
| 3 | Never commit or log secrets | Documented convention | .gitignore + agent reads rules |
| 4 | API cost comparisons — be accurate and specific | Documented convention | Agent reads AGENTS.md/CLAUDE.md |
| 5 | Never fail silently | Documented convention | Agent reads AGENTS.md/CLAUDE.md |
| 6 | No backslash line continuations in shell commands | Documented convention | Agent reads AGENTS.md/CLAUDE.md |
| 7 | One-off fix scripts in scripts/fix/ with --dry-run | Documented convention | Agent reads AGENTS.md/CLAUDE.md |
| 8 | Prefer stored data files over hardcoding (>15 items) | Documented convention | Agent reads AGENTS.md/CLAUDE.md |
| 9 | Executive summaries for monorepo sub-projects | Documented convention | Agent reads AGENTS.md/CLAUDE.md |
| 10 | Cross-repo coordination (paired repos) | Documented convention | Agent reads AGENTS.md/CLAUDE.md |

## Cloud Strategy Conventions

| Convention | Strength | Source |
|-----------|----------|--------|
| Update CloudManagement on cloud resource changes | Documented convention | AGENTS.md lines 135-141 |
| Vendor cloud_management_client (stdlib-only, not pip) | Documented convention | AGENTS.md lines 169-174 |
| Include `application` field in intent/actual reports | Documented convention | AGENTS.md lines 176-182 |
| Client is best-effort (no-op without env vars, never raises) | Documented convention | AGENTS.md lines 191-193 |
| Oracle A1 Always Free = 2 OCPU / 12 GB (not 4/24) | Documented convention | AGENTS.md line 143 |

## Structural Conventions

| Convention | Strength | Evidence |
|-----------|----------|---------|
| AGENTS.md is canonical; CLAUDE.md mirrors | Documented convention | AGENTS.md line 11-13 |
| Version stamp format: `YYYY-MM-DD — sourced from biofool/starter` | Documented convention | AGENTS.md line 1, CLAUDE.md line 1 |
| Project-specific guidance goes below global block in AGENTS.md | Documented convention | AGENTS.md line 8-9 |
| Skills are optional — remove if not needed | Documented convention | README.md line 70 |
| .devin/config.local.json is gitignored (per-project) | Strongly recurring | .gitignore line 7 |
| .claude/settings.local.json is gitignored (per-project) | Strongly recurring | .gitignore line 2 |

## Naming Conventions

| Pattern | Strength | Evidence |
|---------|----------|---------|
| Skill directories: kebab-case (`web-search`, `news-search`) | Strongly recurring (12/12) | .devin/skills/ |
| SKILL.md frontmatter: `name` + `description` fields | Strongly recurring (12/12) | All SKILL.md files |
| Env vars: uppercase with underscores (`BRAVE_SEARCH_API_KEY`) | Strongly recurring | AGENTS.md, SKILL.md files |

## What's NOT Here

- No code conventions (naming, error handling patterns in code) — template has no code
- No test conventions — template has no tests
- No persistence conventions — template has no data layer
- No observability conventions — template has no runtime

These are intentionally left to downstream repos to define in their project-specific sections.
