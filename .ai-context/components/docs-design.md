# Component: docs-design — `docs/`

**Status**: OBSERVED. The coordination hub for the MVP→spec pivot.

## Reading order (docs/README.md)

```
brief.md ──(design + deviations: decisions.md)──▶ spec.md
                                                    │
                                  (gap analysis: spec-vs-mvp.md)
                                                    ▼
                                          legacy/ (MVP code)
                                          backend/ (new build)
```

| File | Role | Edit rules |
|------|------|------------|
| `docs/brief.md` | Original product-owner request | **Do not change** — historical record |
| `docs/spec.md` | Target design v0.1: architecture, PostGIS data model, API, SLA matrix (§4), duplicate rules (§5), build guide M1–M11 (§6) | Design changes also get a `D-xx` row in `decisions.md`; tag the spec line `[D-xx]` |
| `docs/decisions.md` | D-01–D-18 deviation log (Change/Addition/Assumption) | Append-only; never renumber; reversal = mark "Superseded by D-yy" |
| `docs/spec-vs-mvp.md` | Contract/architecture gaps between `legacy/` and spec | Tick gaps off as the new build closes them |

## The load-bearing spec facts

- `computeSLA(severity, location_type)` — SLA hours come from a
  severity × location_type matrix (§4); MVP uses size-only (gap).
- One shared enum for `category`/`location_type` (D-02): reporter sets
  `category` (immutable); staff correct `location_type`; SLA uses
  `location_type`.
- `notification_outbox` table + `worker` service (D-04): API never sends
  email/SMS directly — it writes outbox rows in the same transaction.
- IDs are `bigint` rendered `WL-000123` (D-14).
- Reports outside every zone → `422 outside_service_area` (D-11, needs
  product-owner confirmation).
- `ST_MakePoint(lng, lat)` — longitude first; the spec calls this the most
  common bug.
- Resolved reports stay on the public map for 7 days.

## Open decisions (need a human, from decisions.md)

- **D-08** — SLA hours are placeholders → council Long-Term Plan targets.
- **D-11** — out-of-zone rejection needs product-owner confirmation.
- **D-15** — Railway has no NZ region; data residency (Privacy Act 2020
  IPP 12) needs council confirmation.
