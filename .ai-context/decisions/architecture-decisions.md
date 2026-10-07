# Architecture Decisions

## ADR-001: AGENTS.md as canonical rules source

**Decision**: AGENTS.md is the canonical home for cross-project rules. CLAUDE.md
mirrors the non-negotiable items in condensed form.

**Rationale**: Devin CLI reads AGENTS.md as its native rules file. Claude Code
reads CLAUDE.md. Having two canonical sources would cause desync. AGENTS.md
holds full text; CLAUDE.md holds a mirror.

**Evidence**: AGENTS.md lines 11-13, CLAUDE.md lines 28-30
**Classification**: DECLARED

## ADR-002: GitHub template repository (not a package)

**Decision**: Distribute shared config as a GitHub template repo, not a
pip/npm package or git submodule.

**Rationale**: Template repos create a one-time copy; downstream repos can
diverge without breaking others. Simpler than submodules; no runtime dependency.

**Evidence**: README.md line 3 ("Use this template on GitHub"), README.md line 6
(`gh repo create --template`)
**Classification**: OBSERVED

## ADR-003: Manual sync (no automated mechanism)

**Decision**: Updates to template rules are synced to downstream repos via
manual `curl` + merge, not automated tooling.

**Rationale**: Template repos don't maintain a link to downstream repos. Manual
sync gives control over what changes propagate and when.

**Evidence**: README.md lines 63-68, `shared_template_config.mdc` §Syncing
**Classification**: OBSERVED (no automation found) + DECLARED (sync instructions)

## ADR-004: Skills are optional and self-contained

**Decision**: Brave Search skills ship in `.devin/skills/` but are optional —
repos can remove the directory.

**Rationale**: Not all projects need web search. Skills are self-contained
Markdown files with no internal dependencies.

**Evidence**: README.md line 70 ("Remove the directory if the project doesn't need web search")
**Classification**: DECLARED

## ADR-005: Version stamp for sync tracking

**Decision**: Both AGENTS.md and CLAUDE.md carry a version stamp
(`YYYY-MM-DD — sourced from biofool/starter`) at the top.

**Rationale**: Downstream repos can check if they're current by comparing
their stamp to the template's. The date is the sync date, not the template's
creation date.

**Evidence**: AGENTS.md line 1, CLAUDE.md line 1, `shared_template_config.mdc` §Versioning
**Classification**: DECLARED

## ADR-006: cloud_management_client is vendored, not pip-installed

**Decision**: The CloudManagement client is copied into repos rather than
pip-installed.

**Rationale**: It's stdlib-only (no external deps), so vendoring avoids
dependency management overhead. Trade-off: vendored copies must be manually
kept in sync.

**Evidence**: AGENTS.md lines 169-174
**Classification**: DECLARED

## ADR-007: .gitignore uses negation for .env.example

**Decision**: `.env.*` pattern with `!.env.example` negation.

**Rationale**: Blocks all real env files while allowing an example template
to be committed.

**Evidence**: .gitignore lines 55-56
**Classification**: OBSERVED (inferred rationale)
