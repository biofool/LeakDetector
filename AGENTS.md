<!-- AI coding config version: 2026-07-25 — sourced from biofool/starter template.
     Shared settings across all biofool projects; see ~/.codeium/windsurf/memories/shared_template_config.md -->

# AGENTS.md — Global Rules for AI Agents

These rules apply to **every** project cloned from this template. They are
cross-project conventions distilled from the biofool project portfolio.
Project-specific guidance belongs in `CLAUDE.md` (or a project-specific
`AGENTS.md` section) — keep this file for rules that should hold everywhere.

Devin reads `AGENTS.md` as its native rules file. Claude Code reads
`CLAUDE.md`; the `Global conventions` section of `CLAUDE.md` mirrors the
non-negotiable items below so both agents stay in sync.

## Validation requests — do not change code

When the user asks to validate or check a conclusion, do NOT start changing
code or making edits. Investigate, verify the conclusion against the actual
state of the codebase/data, and report findings only. If the conclusion is
clearly invalid, state that and wait for instructions. Only make code changes
when the user explicitly asks for a fix or implementation.

## Never read secrets files

NEVER read, cat, print, or otherwise access `.env`, `.env.secrets`,
`.env.local`, `*.key`, `credentials*.json`, `service-account*.json`, or any
file containing API keys, tokens, or passwords. If you need a credential
value to complete a task, ask the user to provide it directly or set it as an
environment variable. Do not attempt to discover secrets by reading files.

### Never pull secret VALUES into your context — names and lengths only

Added after an incident where an agent grepped a git-tracked `.env.example`
for `OPENROUTER` and the matching lines — containing three live secret
values — were returned as search results and loaded into the agent's
context. The keys had to be rotated.

**When investigating secrets, you may discover KEY NAMES and VALUE LENGTHS,
but never the VALUES themselves:**

1. **Do NOT grep/rg/search `.env*` files for patterns that match the value
   side.** A grep for `OPENROUTER` against `.env.example` returns the whole
   line `OPENROUTER_API_KEY=sk-or-v1-…`, pulling the secret into context.
   This is a secret read, even though it came from a search tool.
2. **List key names only** (safe): `sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' <file>`
3. **Check if a key is non-empty** (safe — length only, no value):
   `grep "^KEY_NAME=" <file> | head -1 | cut -d'=' -f2- | wc -c` (count > 1
   = non-empty; never print the `cut` output).
4. **`.env.example` / `.env.template` are NOT safe to grep freely** — they
   are git-tracked (not gitignored) and may contain real secrets pasted in
   by mistake. Treat them with the same caution as `.env.secrets`.
5. **If a search result accidentally includes a secret value**, do NOT echo
   it to the user, do NOT put it in commits/PRs, and flag it for rotation.
6. **The only `.env*` files safe for full-line grep** are ones you JUST
   created yourself (known placeholder values). For pre-existing `.env*`
   files, assume real values may be present.

### Secret-pattern reference (for scanners and agents)

Value-side patterns indicating a live secret (not a placeholder). Scanners
should flag these in git-tracked files:

- `sk-or-v1-` — OpenRouter API key
- `AIza[0-9A-Za-z_-]{35}` — Google API key (Maps, Gemini, etc.)
- `glpat-[0-9A-Za-z_-]{20}` — GitLab personal access token
- `sk-[0-9A-Za-z]{48}` — OpenAI API key (`sk-ant-` for Anthropic)
- `ghp_[0-9A-Za-z]{36}` / `gho_[0-9A-Za-z]{36}` — GitHub PAT / OAuth token
- `xox[baprs]-` — Slack token
- `AKIA[0-9A-Z]{16}` — AWS access key ID
- `-----BEGIN .* PRIVATE KEY-----` — PEM private key block

Values like `your-key-here`, `changeme`, `xxx`, `placeholder`, or empty, are
NOT live secrets — scanners should skip them.

## Never commit or log secrets

Never commit credentials, private keys, tokens, or customer-identifying data
to git. Never log secrets to files, stdout, or dashboards. Treat scripts that
touch infrastructure (SSH, Cloudflare, hypervisors, mail, credential stores)
as potentially production-impacting; prefer dry-run flags and documented env
vars. The root `.gitignore` already excludes `.env`, `*.key`, `*.pem`,
`credentials.json`, and `cookies.txt` — keep those entries when editing
`.gitignore`.

### Machine enforcement — pre-commit hook and CI secret scan

In addition to the agent rules above, every biofool repo SHOULD have
machine-level enforcement to catch secrets that slip past the agent:

1. **Pre-commit hook** (`.githooks/pre-commit`): scans staged files for the
   secret patterns listed above and blocks the commit if any are found. Install
   with `git config core.hooksPath .githooks` (or copy to `.git/hooks/`).
2. **Working-tree scanner** (`scripts/scan_secrets.py`): scans the full repo
   working tree (not just staged files) for secret patterns, with `--dry-run`
   and audit JSON output to `data/audit/secret_scan_<timestamp>.json`. Run
   manually or in CI.
3. **CI check** (`.github/workflows/secret-scan.yml`): runs the scanner on
   every push and PR, fails the build if secrets are found in git-tracked files.

The starter template ships all three in `.githooks/pre-commit`,
`scripts/scan_secrets.py`, and `.github/workflows/secret-scan.yml`. See those
files for the exact patterns and installation instructions.

## API cost comparisons — be accurate and specific

When comparing API costs between providers or pricing tiers:

1. **Verify pricing from official sources** — do not quote API pricing from
   memory. Look up the current pricing page for each provider (Google Maps
   Platform, OpenCage, Brave, etc.) or cite the source document (e.g., issue
   body, PRD) the figures come from. Pricing changes frequently.
2. **Distinguish per-call vs. subscription vs. tiered pricing** — never
   compare a per-call rate directly against a flat monthly fee without
   computing the break-even volume. Always state the break-even point
   explicitly.
3. **Separate marginal cost from total cost** — "$0" is only accurate for
   marginal cost within a quota. A $40/month subscription is a real cost even
   if individual calls are "free." Always label which you mean.
4. **Account for free tiers and credits** — Google's $200/month free credit,
   OpenCage's 2,500/day free tier, etc. must be factored in. State whether
   the quoted cost is within or beyond the free tier.
5. **Double-check arithmetic** — verify all multiplications, divisions, and
   break-even calculations before stating them. E.g., "$5/1K calls × 1,921
   calls = $9.61" should be confirmed: 1.921 × $5 = $9.605, rounded to $9.61.
   If the issue body states a figure, verify it rather than repeating it
   uncritically.
6. **State all assumptions** — volume per run, runs per month, which API is
   being replaced, whether caching reduces call count, etc. A cost comparison
   without stated assumptions is misleading.

## Never fail silently

Every exception, auth failure, or unavailable dependency must be logged at
WARNING or ERROR level with a specific message. Silent `pass` or bare
`except: return` blocks are forbidden. If a subsystem degrades gracefully
(e.g. an optional sync is disabled), log *why* it was disabled and surface
the status to the UI, dashboard, or log file.

## No backslash line continuations in shell commands shown to the user

Write commands on a single line — backslash continuations break copy-paste.
Long `gcloud`/`terraform`/`gsutil`/`kubectl` commands stay on one line
regardless of length.

## One-off fix scripts (workflow convention)

When building repair/fix scripts for data quality or operational issues:

1. **Store scripts in `scripts/fix/`** — one-off scripts are OK until they
   work, then integrate into the pipeline.
2. **Do NOT run inline code for repairs** — write a script file, test it,
   iterate on the file.
3. **Always support `--dry-run`** — show what would change before modifying
   the database or external system.
4. **Write results to `data/audit/`** (or `audit/`) — JSON output with
   per-record details for an audit trail.
5. **Support `--limit` and `--offset`** for testing on subsets before full
   runs.

## Prefer stored data files over hardcoding

NEVER hardcode arrays or lookup tables with more than 15 items directly in
source files. Prefer reading from a JSON/YAML/TOML data file (version-
controlled, optionally DVC-tracked) whenever possible, even for smaller
lists. This includes country maps, category definitions, keyword lists,
search terms, alias tables, and any other structured data. If the data
doesn't yet exist as a file, create one and read from it rather than
embedding the values in code. This keeps data maintainable and editable
without code changes.

## Executive summaries (for multi-project repos)

If the repository is a monorepo of independent sub-projects, every top-level
sub-project `README.md` should include a non-technical executive summary
between `<!-- exec-summary: begin -->` and `<!-- exec-summary: end -->`
markers. Write for business/leadership audiences: what the project does and
why it matters, without implementation detail. Update it when purpose,
scope, or audience-facing impact changes.

## Cross-repo coordination (when applicable)

Some projects span two repos with a shared flow (e.g. the Quantum Aikido
coaching system: `quantumaikido.com` frontend + `AIRichardMoon` backend). If
this project is part of such a pair, document the sister repo here and the
coordination rule (e.g. "auth changes MUST update both PRDs and deploy both
repos together"). Mismatched frontend/backend versions break the flow. See
`~/projects/quantumaikido.com/web/AGENTS.md` and
`~/projects/AIRichardMoon/AGENTS.md` for the canonical example.

## Cloud strategy — CloudManagement coordination

**CloudManagement** (`biofool/CloudManagement`) is the canonical source for
cloud strategy across all biofool repos. It maintains a unified inventory of
every cloud project, billing account, service, and job, and defines the
job-placement policy (where to store data, where to run jobs). See
`~/projects/CloudManagement/docs/PRD.md` §6 for the policy.

**Every biofool repo MUST update CloudManagement when it:**

1. Adds, removes, or changes a cloud resource (project, service, bucket, etc.)
2. Changes where data is stored (e.g. moves from Firestore to BigQuery)
3. Changes where jobs run (e.g. moves from Cloud Run to Compute Engine)
4. Adds a new paid API or changes an existing one's usage pattern
5. Changes cloud provider, region, or project

Always Free Oracle Ampere A1 is **2 OCPU / 12 GB** (not 4/24). Shared staging
Docker for WorldStudioFinder and/or coaching origins is
`shared-a1` in CloudManagement `terraform-oracle/`
(`a1-origin.magicsolutions.biz`). Do not put the CloudManagement hub on A1.

**The update process:**

1. Update `config/accounts.yaml` (or Firestore in production) in
   CloudManagement to reflect the new resource.
2. Update `docs/PRD.md` in CloudManagement if the job-placement policy or
   resource taxonomy changes (sections 5–6).
3. Update this template's cloud-strategy section so future repos inherit
   the latest guidance.
4. Update the repo's own PRD (if it has one) with the new where-to-store /
   where-to-run details.

**Conversely, when CloudManagement's strategy changes**, every affected
repo's PRD should be updated with the new guidance.

**Shared-runtime dependencies:** when one repo owns a runtime/library that
other repos consume (e.g. `biofool/story_graph` hosts the shared browsing
runtime used by WorldStudioFinder — story_graph#72, CloudManagement#89),
record it on the *consuming* account's `dependencies:` list in
`config/accounts.yaml` (`[{project_id, capability, note}]`, bookkeeping
only — no kill/billing behavior) and note it in the repo table in
`docs/PRD.md`. Library deps are not service deps — job placement and
storage stay where they are.

### Intent/actual reporting for paid APIs

Repos that call paid APIs integrate the `cloud_management_client` pip package
(stdlib-only, no external deps) to declare expected usage before API calls
and report actuals after. CloudManagement validates actual vs intent, detects
overruns, and can kill the specific job.

**Vendoring:** the client is vendored (copied into the repo) rather than
pip-installed, since it's stdlib-only. See
`~/projects/AIRichardMoon/backend/cloud_management_client/` and
`~/projects/OSenseiDocuments/osensei_archiver/cloud_management_client/` for
examples. Keep the vendored copy in sync when the CloudManagement repo
bumps the version.

**The `application` field:** every intent/actual report includes an
`application` field — the human-readable product name (e.g.
`"OSenseiArchiver"`, `"AIRichardMoon"`) used for dashboard attribution.
This is distinct from `source_repo` (the GitHub repo, e.g.
`biofool/OSenseiDocuments`). Set it via the constructor or the
`CLOUDMANAGEMENT_APPLICATION` env var. Both fields are recorded on every
intent and actual.

**Configuration env vars (all optional — client is a no-op without them):**

- `CLOUDMANAGEMENT_URL` — hub URL (use `http://hub-origin.magicsolutions.biz:8080` for server-to-server calls, or `https://cloud.magicsolutions.biz` for browser/dashboard access, in prod)
- `CLOUDMANAGEMENT_PROJECT_ID` — project ID registered in the hub
- `CLOUDMANAGEMENT_REPORT_TOKEN` — per-project auth token
- `CLOUDMANAGEMENT_APPLICATION` — calling app name (for dashboard attribution)

**Best-effort contract:** the client logs WARNINGs and never raises —
billing reporting must never break the host application. Set
`CLOUDMANAGEMENT_STRICT=true` to raise on errors instead (for testing).

### Operational reports + keep-alive (issue #86)

Repos with long-running cloud jobs can also push **operational reports** to
the hub via `client.submit_report(kind, data)` (`kind`: `heartbeat` or
`daily_report`; `data`: `{title, sections: [{name, rows}], notes}`). The hub
stores the latest report, renders `daily_report` payloads into a combined
daily email to the account's `pipeline_report_email`, and — when the account
has a `keepalive:` block — restarts the reporter's GCE instance if
heartbeats go stale (`POST /keepalive-check`, Cloud Scheduler every 15 min).
Heartbeat posts are best-effort and must never fail the job. See
`~/projects/CloudManagement/docs/PRD.md` §6.4 (issue #86) and
`biofool/WorldStudioFinder` `src/orchestrator/hub_reporter.py` for the
reference producer.

### JEV bounded-decision usage

JEV (`typesafe/jev-1.13` via OpenRouter Decisions) is available for bounded,
structured classification, scoring, routing, guardrail, and verification
work—not open-ended generation. New uses start off/shadow-only, retain the
existing deterministic or LLM fallback, define a labeled evaluation and
confidence/disagreement policy, and preserve existing behavior on API failure.
Security, provider-routing, and kill-switch uses require explicit approval
after calibration and must not make JEV the sole kill authority.

Enabled usage is a paid-API integration: use `JEV_API_KEY` or the shared
`OPENROUTER_API_KEY` from an approved secret store; report CloudManagement
provider `openrouter`, API `decisions`, model and decision-kind metadata; and
verify/register current official pricing before enabling calls. See
`~/projects/CloudManagement/docs/PRD.md` §6.5.

See `~/projects/CloudManagement/docs/per-repo-api-specs.md` for per-repo
integration specs (exact intent declarations, actual reports, kill
descriptors, and call sites for every repo).

## Skills

This template ships Brave Search skills in `.devin/skills/` (web-search,
news-search, images-search, videos-search, suggest, spellcheck, local-pois,
local-descriptions, llm-context, answers, bx, search). They require a
`BRAVE_SEARCH_API_KEY` environment variable to make live calls. See
`.devin/skills/web-search/SKILL.md` for setup.

`.devin/skills/` also carries the shared agent-profile skill set synced from
`~/.agents/skills/` and `~/.claude/skills/` — Cloudflare platform skills
(cloudflare, wrangler, durable-objects, sandbox-*, agents-sdk, typesafe-ai,
turnstile-spin, web-perf, workers-best-practices, cloudflare-email-service,
cloudflare-one), operational skills like `automated-browser-solutions`
(browser automation/e2e alternatives when Chromium cannot run on the host),
and the Newsjack/PR toolchain (newsjack-detector, newsworthiness-check,
angle-generator, find-journalists, journalist-fit-check, fact-check,
crisis-holding, pr-strategist, pr-calendar, press-clip, meanest-editor,
coverage-tracker, story-origin-check, ai-visibility-*, prompt-set-qa, and
friends). The newsjack `news-search` skill is stored as
`newsjack-news-search` to avoid colliding with the Brave Search skill of
the same name — profile installs that want it should symlink it as
`news-search`. When a local profile skill is added or updated, sync it
here so template-generated projects inherit it.
