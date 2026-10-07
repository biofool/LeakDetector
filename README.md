# starter

Personal scaffold for new projects. Use "Use this template" on GitHub, or:

```bash
gh repo create <name> --template biofool/starter --private --clone
```

## What's included

- `.gitignore` — covers Python, Node, common IDE/OS cruft, secrets, Claude
  Code local files, and Devin CLI local config.
- `CLAUDE.md` — skeleton for project-specific guidance to Claude Code, plus
  a mirrored **Global conventions** section (see below).
- `AGENTS.md` — canonical home for **global cross-project rules** read by
  Devin CLI. Edit this file first; the `Global conventions` section of
  `CLAUDE.md` mirrors the non-negotiable items so both agents stay in sync.
- `.claude/settings.json` — empty permissions allowlist to build on as you
  find yourself repeatedly approving the same read-only commands.
- `.devin/config.local.json` — sensible default Devin permission grants for
  common safe read-only + git/gh commands. **Gitignored** — copy in and
  extend per project.
- `.devin/skills/` — bundled Brave Search skills (web-search, news-search,
  images-search, videos-search, suggest, spellcheck, local-pois,
  local-descriptions, llm-context, answers, bx, search). They require a
  `BRAVE_SEARCH_API_KEY` environment variable to make live calls. See
  `.devin/skills/web-search/SKILL.md` for setup. Remove the directory if the
  project doesn't need web search.

## Global rules shipped in this template

These are distilled from the biofool project portfolio and apply to every
project cloned from here:

1. **Validation requests — do not change code.** Investigate and report only.
2. **Never read secrets files.** No `.env`, `*.key`, `credentials*.json`, etc.
3. **Never commit or log secrets.** Keep `.gitignore` entries; treat
   infra scripts as production-sensitive; prefer `--dry-run`.
4. **API cost comparisons — be accurate and specific.** Verify pricing,
   distinguish per-call vs. subscription, compute break-even, separate
   marginal from total cost, account for free tiers, double-check arithmetic,
   state all assumptions.
5. **Never fail silently.** Log every exception at WARNING/ERROR.
6. **No backslash line continuations** in shell commands shown to the user.
7. **One-off fix scripts** in `scripts/fix/`, with `--dry-run`,
   `--limit`/`--offset`, audit JSON to `data/audit/`.
8. **Prefer stored data files over hardcoding** (>15-item lookup tables
   belong in JSON/YAML, not source).
9. **Cross-repo coordination** — if the project is part of a paired repo
   system, document the sister repo and require both PRDs + both repos to be
   updated/deployed together for shared-flow changes.
10. **Executive summaries** for monorepo sub-projects (between
    `<!-- exec-summary: begin -->` / `<!-- exec-summary: end -->` markers).

Full text in `AGENTS.md`.

## After cloning

1. Fill in `CLAUDE.md` (overview, environment, commands, architecture,
   conventions).
2. Add project-specific rules to `AGENTS.md` below the global rules, or
   replace the cross-repo coordination placeholder if this project is part of
   a paired system.
3. Copy `.devin/config.local.json` into place (it's gitignored) and extend
   the permissions allowlist as needed:
   ```bash
   cp .devin/config.local.json.example .devin/config.local.json  # if you add an example
   # or just recreate it — the shipped version is a starting point
   ```
4. If you don't need web search, remove `.devin/skills/`.
5. Delete this section of the README and replace it with the real project
   description.
