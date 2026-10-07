# Technical Marketing Summary — starter (biofool Project Template)

## One-Line Positioning

A GitHub repository template providing AI-agent-ready scaffolding for new biofool projects, with pre-configured Claude Code, Devin CLI, and cross-project convention enforcement.

## Target Users / Personas

- **Developers starting new projects** in the biofool portfolio who need consistent scaffolding
- **AI coding agents** (Claude Code, Devin CLI) that read project configuration files for guidance
- **Teams** wanting enforced conventions across all projects (secrets handling, API cost analysis, error logging)

## Key Features (Grounded in Code)

- **GitHub template repository** — creates new repos via `gh repo create <name> --template biofool/starter` (`README.md`)
- **AGENTS.md** — canonical rules file for Devin CLI with 10 global conventions (validation, secrets, cost comparisons, error handling, shell formatting, fix scripts, data files, executive summaries, cross-repo coordination, skills) (`AGENTS.md`)
- **CLAUDE.md** — skeleton project guidance file for Claude Code with mirrored global conventions (`CLAUDE.md`)
- **Comprehensive .gitignore** — covers Python, Node, IDE, OS, secrets, Claude Code, and Devin CLI files (`.gitignore`)
- **Claude Code settings** — empty permissions allowlist in `.claude/settings.json` to build on
- **Devin CLI config** — default permission grants for safe read-only and git/gh commands in `.devin/` (gitignored)
- **Brave Search skills** — bundled web-search, news-search, images-search, videos-search, suggest, spellcheck, local-pois, local-descriptions, llm-context, answers, bx, and search skills in `.devin/skills/`
- **Cross-repo coordination template** — placeholder for documenting paired-repo systems with shared flows

## Technical Differentiators

- **Dual-agent support** — both Claude Code (`CLAUDE.md`) and Devin CLI (`AGENTS.md`) are pre-configured with synchronized rules
- **Convention enforcement by design** — global rules (never read secrets, never fail silently, accurate API cost comparisons) are baked into the template, not opt-in
- **Skills bundled** — Brave Search API skills ship with the template for immediate web search capability
- **Gitignored local config** — `.devin/config.local.json` and `.claude/settings.local.json` are gitignored, allowing per-project customization without polluting the template

## Use Cases

- Starting a new biofool project with consistent AI agent configuration
- Ensuring every project follows the same secrets-handling and error-logging conventions
- Providing AI coding agents with project context and rules from day one
- Bootstrapping web search capabilities in new projects via bundled Brave skills

## Benefits / Value Proposition

- Zero-configuration scaffolding — clone and start coding with AI agents already configured
- Convention enforcement without manual effort — rules are in the template, not added later
- Dual-agent compatibility — works with both Claude Code and Devin CLI
- Comprehensive gitignore — prevents accidental commits of secrets, caches, and IDE files

## Tech Stack

- **AI Agent Config**: Claude Code (`CLAUDE.md`, `.claude/`), Devin CLI (`AGENTS.md`, `.devin/`)
- **Search Skills**: Brave Search API (`.devin/skills/`)
- **Version Control**: Git, GitHub template repository
- **Languages**: Markdown (documentation), JSON (configuration)

## Known Limitations

- **Biofool-specific** — conventions are tailored to the biofool project portfolio; may not suit other organizations
- **Claude settings minimal** — `.claude/settings.json` is an empty allowlist requiring manual extension
- **Devin config gitignored** — `.devin/config.local.json` must be copied into place after cloning
- **Brave Search requires API key** — skills need a `BRAVE_SEARCH_API_KEY` environment variable to function
- **No code framework** — this is a configuration/documentation template, not a code scaffold
