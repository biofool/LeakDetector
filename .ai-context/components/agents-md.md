# Component: AGENTS.md

## Responsibility

Canonical source of cross-project AI coding rules read by Devin CLI.
Defines 10 global rules + cloud strategy coordination guidance that all
biofool projects inherit. This is the **authoritative** rules file;
`CLAUDE.md` mirrors it.

## Files

- `AGENTS.md` (205 lines)

## Structure

| Section | Lines | Content |
|---------|-------|---------|
| Version stamp | 1-2 | `2026-07-25` config version, sourced-from note |
| Header | 4-13 | Purpose, Devin vs Claude Code split |
| Validation requests | 15-21 | Rule 1: report-only on validation |
| Never read secrets | 23-29 | Rule 2: no .env/*.key/credentials access |
| Never commit secrets | 31-39 | Rule 3: gitignore entries, dry-run preference |
| API cost comparisons | 41-66 | Rule 4: 6-point accuracy checklist |
| Never fail silently | 68-74 | Rule 5: log all exceptions at WARNING/ERROR |
| No backslash continuations | 76-80 | Rule 6: single-line shell commands |
| One-off fix scripts | 82-95 | Rule 7: scripts/fix/, --dry-run, data/audit/ |
| Stored data files | 97-106 | Rule 8: JSON/YAML over hardcoding >15 items |
| Executive summaries | 108-115 | Rule 9: exec-summary markers for monorepos |
| Cross-repo coordination | 117-125 | Rule 10: paired-repo sync pattern |
| Cloud strategy | 127-197 | CloudManagement coordination, intent/actual reporting, vendored client, env vars |
| Skills | 199-205 | Brave Search skills overview |

## Interfaces

- **Input**: none (static document)
- **Output**: rules consumed by Devin CLI at session start
- **Mirror target**: `CLAUDE.md` §"Global conventions" (must stay in sync)

## Dependencies

- **References**: `biofool/CloudManagement` (external repo, cloud strategy)
- **References**: `~/projects/CloudManagement/docs/PRD.md` §6 (job-placement policy)
- **References**: `~/projects/CloudManagement/docs/per-repo-api-specs.md`
- **References**: `~/projects/AIRichardMoon/backend/cloud_management_client/` (vendoring example)
- **References**: `~/projects/quantumaikido.com/web/AGENTS.md` (cross-repo example)

## Consumers

- Devin CLI (primary reader)
- All downstream biofool repos (via template clone + manual sync)
- `CLAUDE.md` (mirror)

## State/Data

None — static Markdown document.

## Boundaries

- Global rules (this file) vs. project-specific guidance (downstream AGENTS.md sections below the global block)
- Cloud strategy section is guidance, not executable — actual cloud inventory lives in CloudManagement

## Change Guidance

**Before modifying AGENTS.md:**
1. This is the **canonical** file — changes propagate to all synced downstream repos
2. **MUST** update `CLAUDE.md` §"Global conventions" to mirror (or rules diverge between Devin and Claude Code)
3. **MUST** bump version stamp date at top of both files
4. If changing cloud strategy: also update `biofool/CloudManagement` PRD and downstream repo PRDs
5. If adding a new rule: add to both AGENTS.md (full text) and CLAUDE.md (condensed mirror)

## Evidence

- OBSERVED: 205-line Markdown file with 10 numbered rules + cloud strategy section
- OBSERVED: version stamp `2026-07-25` at line 1
- DECLARED: "Devin reads AGENTS.md as its native rules file" (line 11)
- DECLARED: "CLAUDE.md mirrors the non-negotiable items" (line 13)
