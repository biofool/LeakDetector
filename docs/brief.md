# Original brief (2026-10-07)

This is the request the spec was written from. It is kept unchanged as a
record. For the design, read [`spec.md`](spec.md); for where the spec
departs from this brief, read [`decisions.md`](decisions.md).

---

You are the senior engineer for a NZ civic open‑source project: a citizen‑led municipal water leak reporting and repair mobilisation app.

Goal: Produce a concise architecture doc, a minimal PostGIS data model, and an API spec that a small team can implement in React + Node + Postgres on Railway.

Context:
- Users report leaks via a mobile‑first PWA (GPS + photo + category).
- Councils receive email/SMS alerts and see a dashboard with live reports and SLA status.
- Categories must match NZ council practice: footpath, berm, road, water_meter, outside_tap, other_public.
- Reports must track SLA based on severity (major/minor) and location type.
- We need duplicate detection (nearby reports within ~30 m) and council zone assignment (point‑in‑polygon).

Deliverables (markdown in this chat):
1) Architecture overview (max 1 page):
   - Components: React PWA, Node/Express API, Postgres+PostGIS, email/SMS notifications, public dashboard.
   - Deployment target: Railway (one project, Git‑based deploys).
   - Data flow for a new leak report (from submission to council alert to resolution).
2) Data model:
   - SQL for tables: reports, report_photos, council_zones, users (optional for council staff).
   - Include fields: id, geom (PostGIS), category (enum), severity (enum: major/minor), description, location_type (footpath/berm/road/water_meter/outside_tap/other_public), status (enum: received/investigating/contractor_assigned/resolved/closed_private), reporter_name, reporter_contact, created_at, updated_at, council_zone_id, sla_due_at, verified (bool), is_duplicate_of (nullable FK).
   - Add PostGIS index on geom, and any useful indexes for status/category lookups.
3) API spec (OpenAPI‑style, concise):
   - POST /reports: create a leak report (body: category, location_type, severity, description, lat, lng, reporter_name, reporter_contact, photos[]).
   - GET /reports/nearby?lat=&lng=&radius_m=: return nearby reports for duplicate detection.
   - GET /reports/:id: fetch a single report with status and photos.
   - PATCH /reports/:id: update status, verified, is_duplicate_of, etc. (council staff only).
   - GET /reports?status=&category=&council_zone_id=: list/filter reports for dashboard.
   - For each endpoint: method, path, auth (public vs staff), key request/response fields, and example JSON.
4) SLA rules (NZ‑flavoured):
   - Define SLA calculation logic: given severity + location_type, compute sla_due_at (e.g., major road/meter leaks ≤12 hours, minor footpath/berm ≤3 days, etc.).
   - Express as a simple table and a formula/pseudocode function: computeSLA(category, location_type, created_at) → sla_due_at.
5) Duplicate detection logic:
   - Describe how to find potential duplicates within 30 m using PostGIS (ST_DWithin) and how to present them to the user before final submission.

Constraints:
- Keep it implementation‑ready: a junior dev should be able to code directly from this.
- Use NZ English spelling and terminology (footpath, berm, etc.).
- Assume PostGIS is enabled on the Postgres instance.

---

## Addendum (2026-10-07, same day)

The product owner added this line to the end of the brief:

> Assume Windsurf SWE‑2 will implement this spec in a monorepo with /backend (Node/Express + PostGIS) and /frontend (React + Vite + Tailwind). Keep the spec implementation‑ready for Windsurf.

How the spec applies it: see [`decisions.md` D-18](decisions.md#d-18) and
[`spec.md` §6](spec.md#6-implementation-guide-windsurf-swe-2).
