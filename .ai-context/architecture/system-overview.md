# System Overview — biofool/starter

## A. System Context

This repo is a **configuration distribution hub**, not a running system.

```
┌─────────────────────────────────────────────────────────────┐
│                  biofool/starter (template)                   │
│                                                               │
│  AGENTS.md ──┐                                                │
│  CLAUDE.md ──┤  10 global rules + cloud strategy              │
│  .gitignore ─┤  secrets/cruft prevention                      │
│  .claude/ ───┤  permissions scaffold                          │
│  .devin/ ────┘  12 Brave Search skills                        │
│                                                               │
│  "Use this template" on GitHub ── or ── gh repo create        │
└──────────────────────┬──────────────────────────────────────┘
                       │ clone (one-time)
                       ▼
    ┌──────────────────┴──────────────────┐
    │     Downstream biofool repos         │
    │  (AIRichardMoon, quantumaikido.com,  │
    │   WorldStudioFinder, CloudManagement,│
    │   AikiField, ClipQuotes, etc.)       │
    └──────────────────────────────────────┘
                       │ manual curl + merge (ongoing sync)
                       ◄──────────────────────────────────
                       │
    ┌──────────────────┴──────────────────┐
    │  biofool/CloudManagement (external)  │
    │  Canonical cloud strategy source     │
    │  Referenced by AGENTS.md §cloud      │
    └──────────────────────────────────────┘
```

### Users
- **Developers** creating new biofool projects (clone template)
- **AI coding agents** (Devin, Claude Code) reading rules at runtime
- **Maintainer** updating shared rules across the portfolio

### External Systems
- **GitHub** — template hosting, `gh repo create --template`
- **Brave Search API** — skills document usage but contain no executable code; requires `BRAVE_SEARCH_API_KEY`
- **CloudManagement repo** (`biofool/CloudManagement`) — referenced by cloud strategy section; not part of this repo

### Trust Boundaries
- Template content is trusted as-is by downstream repos (OBSERVED: no validation layer)
- `.devin/config.local.json` and `.claude/settings.local.json` are gitignored — per-project override boundary
- Secrets are excluded by `.gitignore` (`.env`, `*.key`, `*.pem`, `credentials.json`, `cookies.txt`)

## B. Deployable Units

**None.** Zero application code. No services, frontends, APIs, workers, CLIs,
jobs, databases, or queues. This is a documentation/configuration template.

## C. Components

See `../components/` directory for per-component files:
- `agents-md.md` — canonical rules (highest-traffic, highest-risk)
- `claude-md.md` — mirror file (must stay in sync with AGENTS.md)
- `devin-skills.md` — 12 Brave Search skill definitions
- `gitignore.md` — secrets/cruft prevention policy

## D. Runtime/Code Paths

**N/A.** No runtime. The only "paths" are:
1. **Clone path**: GitHub template → new repo (one-time, via `gh repo create`)
2. **Sync path**: `curl` template AGENTS.md → manual merge into downstream repo (ongoing)
3. **Read path**: AI agent reads AGENTS.md/CLAUDE.md at session start

See `../workflows/template-sync.md` for the sync workflow.

## E. Change Impact Summary

| Change | Affects | Risk |
|--------|---------|------|
| Edit AGENTS.md global rules | All downstream repos that synced | High — rules diverge if CLAUDE.md not updated |
| Edit CLAUDE.md mirror | Claude Code behavior in downstream repos | Medium — must match AGENTS.md |
| Add/remove skill | Downstream repos with skills dir | Low — skills are self-contained |
| Edit .gitignore | Downstream repo commit hygiene | Medium — removing secrets entries risks leaks |
| Edit cloud strategy section | All repos referencing CloudManagement | High — stale guidance → wrong cloud placement |
