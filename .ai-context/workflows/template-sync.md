# Workflow: Template Sync (downstream repo ← starter template)

## Entry Point

A downstream biofool repo needs to update its global rules block to match
the latest template. Triggered manually when the template's AGENTS.md changes.

## Execution Path

1. **Fetch latest template AGENTS.md**
   - Command: `curl -s https://raw.githubusercontent.com/biofool/starter/main/AGENTS.md`
   - Source: GitHub raw content URL
   - Evidence: README.md lines 63-68, `shared_template_config.mdc` rule

2. **Identify the global rules block in the downstream repo's AGENTS.md**
   - The block between the version stamp and the project-specific section
   - Preserve project-specific sections below the global block

3. **Manually merge the global rules section**
   - Replace the downstream's global block with the template's content
   - Do NOT overwrite project-specific sections
   - Evidence: README.md line 65 "Manually merge the global rules section"

4. **Update the version stamp date**
   - Format: `> AI coding config version: YYYY-MM-DD — sourced from biofool/starter`
   - Set to the date of the sync (not the template's date)
   - Evidence: AGENTS.md line 1, `shared_template_config.mdc` §Versioning

5. **Mirror changes to CLAUDE.md**
   - Update the "Global conventions" section to match
   - Update CLAUDE.md version stamp to the same date
   - Evidence: CLAUDE.md line 1, AGENTS.md line 13

6. **Commit and deploy**
   - Commit both AGENTS.md and CLAUDE.md together
   - Evidence: `shared_template_config.mdc` (commit in same cycle)

## Evidence

- `README.md` lines 57-71 (after-clone checklist)
- `AGENTS.md` line 1 (version stamp format)
- `CLAUDE.md` line 1 (version stamp format)
- `shared_template_config.mdc` (external rule file, sync instructions)

## Failure Paths

- **Merge conflict**: project-specific sections accidentally overwritten → restore from git history
- **Version stamp not updated**: downstream repo can't tell if it's current → always bump date
- **CLAUDE.md not mirrored**: Devin and Claude Code apply different rules → always sync both
- **Template unavailable**: GitHub raw URL fails → retry or clone template locally

## Change Guidance

- This is a **manual process** — no automated sync mechanism exists (UNKNOWN-003)
- The sync is one-directional: template → downstream (downstream changes don't propagate back)
- If a rule needs to change: edit the template first, then sync to all downstream repos
- Cloud strategy changes require additional updates to CloudManagement repo (see `cloud-strategy-sync.md`)
