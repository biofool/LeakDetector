# Component: `.devin/skills/`

**Status**: OBSERVED — large bundled skill library inherited from
`biofool/starter` (~100 SKILL.md files), NOT project-specific.

## What's here

- **Brave Search suite**: `web-search`, `news-search`, `images-search`,
  `videos-search`, `suggest`, `spellcheck`, `local-pois`,
  `local-descriptions`, `llm-context`, `answers`, `bx` — all need
  `BRAVE_SEARCH_API_KEY` for live calls
- **ponytail suite**: `ponytail`, `ponytail-review`, `ponytail-audit`,
  `ponytail-debt`, `ponytail-gain`, `ponytail-help` — minimal-diff
  discipline
- **UI/UX + site-builder suite**: `senior-ui-ux-orchestrator`,
  `webapp-ui-skill`, `marketing-site-skill`, `ui-ux-pro-max`, Figma/Stitch
  bridges, SEO/LLM site skills, `deploy-orchestrator`,
  `server-provisioner`, `domain-*`, `ssl-and-security-hardener`, …
- **Cloudflare suite**: `cloudflare`, `wrangler`, `workers-best-practices`,
  `durable-objects`, `agents-sdk`, `sandbox-*`, `turnstile-spin`, …
- **PR/newsjack suite**: `angle-generator`, `fact-check`,
  `find-journalists`, `coverage-tracker`, `newsjack-*`, `pr-*`, …

## Relevance to this project

Most are cargo from the template. The ones that plausibly matter for
LeakDetector's actual work: `server-provisioner`/`deploy-orchestrator`/
`domain-*`/`ssl-and-security-hardener`/`webmaster-registrar` (Railway
launch + council DNS/TLS), `web-security-architect` (public civic form),
`webapp-ui-skill`/`marketing-site-skill` (frontend build M8–M10),
`automated-browser-solutions` (e2e on this host), Brave skills only if a
search need arises.
