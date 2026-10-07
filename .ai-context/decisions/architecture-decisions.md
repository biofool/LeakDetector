# Architecture Decisions — biofool/LeakDetector

The authoritative decision log is **`docs/decisions.md`** (D-01–D-18,
with Status). This file summarizes the load-bearing ones; add new design
deviations there, not here.

## D-18 — Monorepo rebuild (Change, brief addendum)

Spec targets Node/Express + PostGIS `/backend` + React/Vite/Tailwind
`/frontend`, built by Windsurf SWE-2. The FastAPI/SQLite MVP is frozen in
`legacy/`. **Evidence**: docs/decisions.md D-18, commit `0d2650f`.
**Classification**: DECLARED (backend in progress; frontend not started).

## D-04 — Notification outbox + worker (Addition)

API never sends email/SMS directly; it writes `notification_outbox` rows
in the same transaction as the report. A worker drains every 30 s
(`FOR UPDATE SKIP LOCKED`, 5 retries → `failed`), runs the SLA sweep every
5 min with `dedupe_key`, and cascades resolution to duplicates.
**Evidence**: docs/decisions.md D-04, spec §1.4–§3; `backend/src/worker.ts`.
**Classification**: DECLARED→OBSERVED (outbox service exists in backend/).

## D-02 — Shared category/location_type enum (Change)

Reporter sets `category` (immutable); staff maintain `location_type`;
**SLA uses `location_type`**. Same enum for both.
**Evidence**: docs/decisions.md D-02, spec §2.

## D-01 — `computeSLA(severity, …)` not category (Change)

SLA matrix keyed on severity × location_type (spec §4); MVP used size-only.
**Evidence**: D-01, spec §4, `backend/src/services/sla.ts`.

## D-05 / D-12 — JWT staff auth + council scoping (Addition)

`POST /auth/login` issues JWT; reporter contact visible only to the owning
council's staff (replaces the MVP's single static `X-Staff-Token`).
**Evidence**: D-05, D-12; `backend/src/routes/auth.ts`,
`middleware/staffAuth.ts`.

## D-10 — Duplicates: link, no chains, cascade (Assumption)

Staff set `is_duplicate_of`; no duplicate chains; resolving the canonical
report resolves duplicates. **Evidence**: D-10, spec §5.

## D-09 / D-14 — PostGIS + public refs (Assumption/Addition)

`geometry(Point,4326)`, metre-accurate `::geography` casts +
expression index; bigint ids shown as `WL-000123`.
**Evidence**: D-09, D-14, spec §2.

## D-17 — Photos optional, re-encoded, EXIF stripped (Assumption)

0–3 photos, ≤2 MB browser-compressed, sharp re-encode to webp, EXIF
stripped, `is_hidden` moderation flag. **Evidence**: D-17;
`backend/src/services/photos.ts`.

## D-15 — Railway deploy, no NZ region (Assumption, NEEDS CONFIRMATION)

Data residency risk under Privacy Act 2020 IPP 12 — see
`unknowns/register.yaml` UNKNOWN-003.
