# Components — biofool/LeakDetector

| Component | File | What it is |
|-----------|------|------------|
| `legacy-mvp` | `legacy-mvp.md` | FastAPI + SQLite + Leaflet MVP in `legacy/` — frozen reference implementation |
| `backend-build` | `backend-build.md` | Spec'd Node/TS/Express/PostGIS API + worker being built in `backend/` |
| `docs-design` | `docs-design.md` | The design pack in `docs/` — brief / spec / decisions / spec-vs-mvp |
| `agents-md` | `agents-md.md` | `AGENTS.md` — canonical biofool global rules |
| `claude-md` | `claude-md.md` | `CLAUDE.md` — Claude mirror + project-specific section |
| `devin-skills` | `devin-skills.md` | `.devin/skills/` — bundled agent skills |
| `gitignore` | `gitignore.md` | `.gitignore` — secrets + runtime-data policy |
| `security-tooling` | (this file) | `scripts/scan_secrets.py`, `scripts/audit-deps.sh`, `.githooks/pre-commit`, `.github/workflows/{secret-scan,dependency-review,dependency-audit}.yml` — the three-layer gate from the starter template |

## Security tooling (detail)

- `.githooks/pre-commit` scans staged files for known secret patterns;
  install via `git config core.hooksPath .githooks`.
- `scripts/scan_secrets.py` — full working-tree scan, `--dry-run`, JSON
  audit to `data/audit/`.
- `scripts/audit-deps.sh` — shared by `.github/workflows/dependency-audit.yml`
  (scheduled) and intended as a deploy preflight.
- `.github/workflows/dependency-review.yml` — PR-time gate
  (`fail-on-severity: high`).
