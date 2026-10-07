# Workflows — biofool/LeakDetector

| Workflow | File | Trigger |
|----------|------|---------|
| Spec build | `spec-build.md` | Implementing `docs/spec.md` milestones in `backend/`/`frontend/` |
| Template sync | `template-sync.md` | biofool/starter global rules change |
| Cloud-strategy sync | `cloud-strategy-sync.md` | this repo gains real cloud resources (Railway, S3, mail/SMS) |

## Not present

- No deploy workflow yet — spec targets Railway (M11); nothing deployed.
- No CI test workflow — `.github/workflows/` is security gates only
  (secret-scan, dependency-review, dependency-audit).
