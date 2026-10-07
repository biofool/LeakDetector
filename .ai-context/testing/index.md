# Testing — biofool/LeakDetector

## What exists

| Suite | Location | Runner | Tests |
|-------|----------|--------|-------|
| MVP API tests | `legacy/tests/test_api.py` | `python3 -m pytest legacy/tests/ -q` | 7 |
| Backend tests | `backend/` (jest.config.cjs configured) | `npm test` in `backend/` | 0 written yet — spec M2/M3 define the acceptance tests |

## MVP coverage map

See `test-map.yaml`. The 7 tests cover: create+get report, bounds
validation, category validation, nearby-duplicate detection, confirm flow,
staff-token gating on status changes, stats shape. **Not covered**: photo
upload, notify paths, zone assignment edge cases.

## Spec test contract (docs/spec.md §6.6)

Acceptance checks are per-milestone: M2 requires the full SLA matrix +
`due_soon`/`breached` boundary tests; M3 zone 201/422 + public-serializer
absence of `reporter_*`; M4 nearby radius + 409-on-resolved-confirm; M5
EXIF-strip proof via exiftool + 4th-file 400; M6 every status transition
allowed/refused + cross-council 403; M7 outbox idempotency + provider
failure backoff.

## Gaps

- No e2e/browser tests anywhere (MVP has none; spec has no e2e milestone)
- No CI test workflow — `.github/workflows/` only has the 3 security gates
- `legacy/tests/` won't run from repo root without path care post-move
