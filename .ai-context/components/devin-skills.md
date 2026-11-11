# Component: `.devin/skills/`

**Status**: OBSERVED — trimmed vendored set synced from `biofool/starter`
(issue #66). Selection is recorded in `.devin/skills-manifest.json`
(`keep` list); re-sync with starter's `scripts/sync-skills.sh`.

## What's here

- **Brave Search suite** (`core` set): `web-search`, `news-search`,
  `images-search`, `videos-search`, `suggest`, `spellcheck`,
  `local-pois`, `local-descriptions`, `llm-context`, `answers`, `bx`,
  `search` — all need `BRAVE_SEARCH_API_KEY` for live calls
- **Launch/infra**: `server-provisioner`, `deploy-orchestrator`,
  `domain-dns-configurator`, `domain-name-generator`,
  `domain-registrar-advisor`, `ssl-and-security-hardener`,
  `webmaster-registrar` — Railway launch + council DNS/TLS work
- **Frontend/security**: `webapp-ui-skill`, `marketing-site-skill`,
  `web-security-architect` — frontend build M8–M10, public civic form
- **Ops**: `automated-browser-solutions` (e2e on this host), `shared/`
  (support files referenced by the UI skills)

## What was removed

The rest of the starter library (~111 dirs: Figma/Stitch, PR/newsjack,
SEO/LLM site-building, Cloudflare platform, ponytail, and other suites)
was template cargo with no LeakDetector use. If a removed skill becomes
relevant, add its name to `keep` in `.devin/skills-manifest.json` and
re-run starter's `scripts/sync-skills.sh`.
