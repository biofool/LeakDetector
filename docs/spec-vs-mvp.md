# Spec vs MVP — gap list

What the FastAPI + SQLite MVP in [`legacy/`](../legacy) does, versus what
[`spec.md`](spec.md) requires. Read this with [`decisions.md`](decisions.md).

## Naming / contract gaps (breaking)

| Spec | MVP |
|---|---|
| `water_meter`, `other_public` | `meter`, `other` |
| `severity`: `major`/`minor` | `size`: `trickle`/`steady`/`flowing`/`burst`/`unknown` |
| `resolved`, `closed_private` | `repaired`, `private_owner` (plus `duplicate`, `rejected`) |
| `is_duplicate_of`, `reporter_name`, `verified`, `resolved_at`, `public_note`, `gps_accuracy_m` | absent |
| `council_zone_id` FK → `council_zones` → `councils` | `council_zone` free-text from optional GeoJSON |
| SLA = severity × location_type matrix (§4) | SLA = size only |
| `GET /reports` filters: `category`, `severity`, `council_zone_id`, `sla`, `bbox`, `updated_since`, `geojson`, paging | `status` only, `limit` |

## Architecture gaps

- Postgres + PostGIS (`geom`, `ST_DWithin` in metres, `ST_Covers` zones) vs SQLite + haversine scan.
- `report_photos` table + S3-compatible storage + sharp re-encode/EXIF strip vs JSON column + local disk.
- `notification_outbox` + worker (30 s drain, 5 min SLA sweep) vs synchronous SMTP-with-log-fallback.
- JWT staff auth (`POST /auth/login`, council scoping) vs static `X-Staff-Token`.
- React/Vite/Tailwind PWA vs no-build static pages.
- Status transition rules, duplicate no-chain/same-council checks, SLA recalc on staff edit, resolution cascade — all absent in MVP.

## Open decisions needing a human (from decisions.md)

- **D-08** — SLA hours are placeholders; get each council's Long-Term Plan targets.
- **D-11** — Reports outside all zones are rejected (`422`); confirm with product owner.
- **D-15** — Railway has no NZ region; confirm data residency with partner councils (Privacy Act 2020, IPP 12).
- **D-23** — story_graph export: email carries the public `GET /api/v1/reports/{id}` JSON URL (resolved — the `/r/{id}` SPA yields no text to a non-JS fetcher).

## Known MVP bugs (fixed by rewrite, not patched)

- Reporter status-change email never sends — public serializer strips `reporter_contact` before the notify call reads it.
- `PATCH` without `duplicate_of` wipes an existing duplicate link.
