# Workflow: CloudManagement coordination

Per `AGENTS.md` §"Cloud strategy", CloudManagement
(`biofool/CloudManagement`, `~/projects/CloudManagement`) is the canonical
inventory of every biofool cloud resource.

## Current state

**Nothing to register yet.** The repo today is local-only: SQLite file,
local disk photos, SMTP-via-env email. No cloud resources exist.

## When it fires (spec M11 + providers)

The moment the spec build provisions real services, update CloudManagement
`config/accounts.yaml` (or `POST /api/v1/accounts`):

| Spec'd resource | Provider | Notes |
|-----------------|----------|-------|
| App hosting (web/api/worker) | Railway | not GCP; still register — inventory is cross-provider |
| Postgres + PostGIS | Railway plugin | data store location |
| Photo bucket | S3-compatible (R2 or AWS S3) | |
| Email | Postmark or AWS SES | **paid API** → intent/actual reporting via `cloud_management_client` |
| SMS | Twilio or NZ gateway | **paid API** → same |

## Also required

- `docs/PRD.md` in CloudManagement if job-placement policy changes.
- The repo's own docs (`docs/spec.md` deploy section) already name the
  targets — keep them in sync.
- Paid API calls should eventually report intent/actual via the vendored
  `cloud_management_client` (stdlib-only; `application` field =
  `"LeakDetector"`, `source_repo` = `biofool/LeakDetector`). Not vendored
  yet — add when the worker actually calls providers.
