# Component: .gitignore

## Responsibility

Prevents accidental commits of secrets, build artifacts, IDE files, OS cruft,
and AI agent local config. Shared across all downstream biofool repos.

## Files

- `.gitignore` (82 lines)

## Categories

| Category | Lines | Key Entries |
|----------|-------|-------------|
| Claude Code | 1-4 | `.claude/settings.local.json`, `.claude/agent-memory/`, `.mcp.json` |
| Devin CLI | 6-7 | `.devin/config.local.json` |
| Python | 9-32 | `__pycache__/`, `*.pyc`, `.venv/`, `*.egg-info/`, `build/`, `dist/` |
| Node | 34-43 | `node_modules/`, `.next/`, `.nuxt/`, `.turbo/` |
| Testing/coverage | 45-51 | `.pytest_cache/`, `.coverage`, `htmlcov/`, `.tox/` |
| Env/secrets | 53-60 | `.env`, `.env.*` (with `!.env.example`), `*.pem`, `*.key`, `credentials.json`, `cookies.txt` |
| Logs | 62-64 | `*.log`, `logs/` |
| Caches | 66-68 | `.cache/`, `.test_cache/` |
| IDE | 70-74 | `.idea/`, `.vscode/`, `*.swp`, `*.swo` |
| OS | 76-78 | `.DS_Store`, `Thumbs.db` |
| Temp | 80-82 | `*.tmp`, `*.bak` |

## Notable Patterns

- `.env.*` with `!.env.example` negation — allows example template but blocks real env files (OBSERVED)
- AI agent local config is gitignored: `.claude/settings.local.json`, `.devin/config.local.json` (OBSERVED)
- AGENTS.md rule 3 explicitly says "keep those entries when editing .gitignore" (DECLARED)

## Dependencies

None — standalone file.

## Consumers

- All downstream biofool repos (inherited on clone)
- Git (enforces ignore rules)

## Change Guidance

**Before modifying .gitignore:**
1. **NEVER remove** secrets entries (`.env`, `*.key`, `*.pem`, `credentials.json`, `cookies.txt`) — AGENTS.md rule 3
2. Adding entries: ensure they don't conflict with existing patterns
3. Removing entries: verify no downstream repo depends on the ignore rule
4. The `!.env.example` negation must be preserved if `.env.*` pattern remains

## Evidence

- OBSERVED: 82-line .gitignore with 11 categories
- OBSERVED: `!.env.example` negation at line 56
- DECLARED: "keep those entries when editing .gitignore" (AGENTS.md line 38-39)
