# Workflow: Cloud Strategy Sync

## Entry Point

A biofool repo changes its cloud footprint (adds/removes resources, changes
data store, changes job placement, adds paid API). The template's cloud
strategy section must be updated so future repos inherit the latest guidance.

## Execution Path

1. **Update CloudManagement inventory**
   - File: `config/accounts.yaml` (or Firestore in production) in `biofool/CloudManagement`
   - Reflect the new/changed cloud resource
   - Evidence: AGENTS.md lines 148-151

2. **Update CloudManagement PRD if policy changed**
   - File: `docs/PRD.md` in CloudManagement, sections 5-6
   - Evidence: AGENTS.md line 152

3. **Update this template's cloud-strategy section**
   - File: `AGENTS.md` §"Cloud strategy — CloudManagement coordination"
   - So future repos inherit the latest guidance
   - Evidence: AGENTS.md line 154

4. **Update the repo's own PRD**
   - If the repo has a PRD, update where-to-store / where-to-run details
   - Evidence: AGENTS.md line 156

5. **Mirror to CLAUDE.md**
   - Update the cloud strategy bullet in CLAUDE.md §"Global conventions"
   - Evidence: CLAUDE.md lines 73-78

6. **Bump version stamps**
   - Update version date in both AGENTS.md and CLAUDE.md
   - Evidence: version stamp convention

## Conversely (CloudManagement strategy changes)

1. Update `docs/PRD.md` in CloudManagement
2. Update every affected repo's PRD with new guidance
3. Update this template's cloud-strategy section
4. Bump `cloud_management_client` package version if API protocol changed; update consumers

## Evidence

- `AGENTS.md` lines 127-197 (full cloud strategy section)
- `AGENTS.md` lines 148-157 (update process)
- `AGENTS.md` lines 159-160 (converse process)
- `CLAUDE.md` lines 73-78 (mirrored cloud strategy)

## Failure Paths

- **Template not updated**: future repos inherit stale guidance → always update template
- **CloudManagement not updated**: inventory drifts from reality → always update first
- **Vendored client out of sync**: API protocol changes break consumers → bump version + update all vendored copies

## Change Guidance

- Cloud strategy is **guidance**, not executable — actual inventory lives in CloudManagement
- The `cloud_management_client` is vendored (copied into repos), not pip-installed
- Env vars are all optional — client is a no-op without them (best-effort contract)
- `CLOUDMANAGEMENT_STRICT=true` raises errors instead of logging (for testing only)
