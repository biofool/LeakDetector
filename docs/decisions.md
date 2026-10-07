# Design decisions — where the spec departs from the brief

Each entry compares [`brief.md`](brief.md) with [`spec.md`](spec.md). The
`[D-xx]` tags in `spec.md` point here.

**Types**
- **Change** — the spec does something different from what the brief says.
- **Addition** — the brief did not ask for it; the spec adds it.
- **Assumption** — the brief left it open; the spec picks a default that someone must confirm.

**How to add a decision:** give it the next number, fill in all four fields,
and tag the matching line in `spec.md` with `[D-xx]`. Do not renumber old
entries. If a decision is reversed, mark it **Superseded by D-yy** and leave
the text.

| ID | Type | Summary | Status |
|---|---|---|---|
| [D-01](#d-01) | Change | `computeSLA` takes `severity`, not `category` | Accepted |
| [D-02](#d-02) | Change | `category` and `location_type` share one enum; reporter cannot set `location_type` | Accepted |
| [D-03](#d-03) | Addition | `councils` table | Accepted |
| [D-04](#d-04) | Addition | `notification_outbox` table + `worker` service | Accepted |
| [D-05](#d-05) | Addition | `POST /auth/login` (JWT) for staff | Accepted |
| [D-06](#d-06) | Addition | `POST /reports/:id/confirm` + `confirmation_count` | Accepted |
| [D-07](#d-07) | Addition | Extra columns: `gps_accuracy_m`, `public_note`, `resolved_at`, `report_photos.is_hidden` | Accepted |
| [D-08](#d-08) | Assumption | SLA hours are placeholders mapped to DIA urgent / non-urgent | **Needs council confirmation** |
| [D-09](#d-09) | Assumption | Store `geometry(Point,4326)`, query as `geography` | Accepted |
| [D-10](#d-10) | Assumption | Only staff set `is_duplicate_of`; no chains; resolution cascades | Accepted |
| [D-11](#d-11) | Assumption | Reports outside every zone are rejected (`422`), not stored | **Needs product-owner confirmation** |
| [D-12](#d-12) | Addition | Reporter name/contact visible only to owning council's staff | Accepted |
| [D-13](#d-13) | Assumption | Nearby search: recent resolved included, no category filter, radius widened by GPS accuracy | Accepted |
| [D-14](#d-14) | Assumption | `bigint` ids shown as `WL-000123` | Accepted |
| [D-15](#d-15) | Addition | Data-residency check (Railway has no NZ region) | **Needs council confirmation** |
| [D-16](#d-16) | Assumption | Chatham Islands out of scope for v1 | Accepted |
| [D-17](#d-17) | Assumption | Photos optional (0–3), re-encoded, EXIF stripped | Accepted |
| [D-18](#d-18) | Change (brief addendum) | Monorepo `/backend` + `/frontend`, Tailwind, built by Windsurf SWE‑2 | Accepted |

---

<a id="d-01"></a>
## D-01 — `computeSLA` takes `severity`, not `category` (Change)

- **Brief said:** `computeSLA(category, location_type, created_at) → sla_due_at`.
- **Spec does:** `computeSLA(severity, location_type, created_at)`.
- **Why:** The same brief says "SLA based on severity (major/minor) and location type". `category` and `location_type` hold the same values (see D-02), so passing both gives no severity input at all. We read the signature as a typo.
- **Code impact:** `src/sla.js`. Any caller passes `severity` first.

<a id="d-02"></a>
## D-02 — `category` and `location_type` share one enum (Change)

- **Brief said:** Two fields, `category` (enum) and `location_type`, with the **same six values**. Both appear in the `POST /reports` body.
- **Spec does:** One Postgres enum `leak_location` used by both columns.
  - `category` = what the reporter picked. Never edited. Keeps the original report honest.
  - `location_type` = copied from `category` on create. Staff correct it after inspection (e.g. reporter said "berm", crew found it under the road).
  - SLA uses `location_type`.
  - `POST /reports` does **not** accept `location_type`.
- **Why:** Asking the reporter the same question twice adds friction and invites mismatched answers. Keeping both columns still meets the brief's field list and gives staff a correction path without losing the original.
- **Code impact:** Migration enum; `POST` validator ignores/rejects `location_type`; `PATCH` accepts it.

<a id="d-03"></a>
## D-03 — `councils` table (Addition)

- **Brief said:** Tables `reports`, `report_photos`, `council_zones`, `users`.
- **Spec does:** Adds `councils`. `council_zones.council_id` and `users.council_id` reference it.
- **Why:** One council has many zones. Staff need to see every report for their council, not one zone. Without a council row, staff scoping would need a text code repeated across tables.
- **Code impact:** Migration; auth middleware scopes queries by `users.council_id`.

<a id="d-04"></a>
## D-04 — Notification outbox + worker service (Addition)

- **Brief said:** "Councils receive email/SMS alerts." No mechanism given.
- **Spec does:** API inserts rows into `notification_outbox` in the **same transaction** as the report change. A separate `worker` service sends them, retries 5× with backoff, then marks `failed` and logs at ERROR. The worker also runs the SLA sweep every 5 min.
- **Why:**
  - If the API sent email directly and the provider was down, the alert would be lost or the request would fail. The outbox makes alerts durable.
  - Repo rule: *never fail silently* — failed sends stay visible in the table.
  - `dedupe_key` stops the SLA sweep sending the same breach alert every 5 min.
  - Uses Postgres only; no Redis or queue product to run on Railway.
- **Code impact:** Migration; `src/worker.js`; extra Railway service.

<a id="d-05"></a>
## D-05 — `POST /auth/login` (Addition)

- **Brief said:** `PATCH` is "council staff only". No login endpoint listed.
- **Spec does:** Email + password login returning an 8 h JWT. Passwords hashed with argon2id or bcrypt.
- **Why:** "Staff only" needs a way to identify staff and their council. JWT keeps the API stateless.
- **Code impact:** Auth route, middleware, rate limit 10 per 15 min.

<a id="d-06"></a>
## D-06 — "I've seen it too" confirm endpoint (Addition)

- **Brief said:** Show nearby reports before submission. No action defined for "yes, that's the same leak".
- **Spec does:** `POST /reports/:id/confirm` adds 1 to `reports.confirmation_count`. The reporter flow ends there.
- **Why:** Without it, the reporter's only choice is to submit a duplicate anyway. The count is also a useful signal of impact for staff.
- **Code impact:** One endpoint, one column, rate limit 10 per hour per IP; `409` on resolved reports.

<a id="d-07"></a>
## D-07 — Extra columns (Addition)

| Column | Why |
|---|---|
| `reports.gps_accuracy_m` | Widens the duplicate search when GPS is poor (D-13); helps crews judge the pin. |
| `reports.public_note` | Lets staff tell the public "crew booked Thursday" without exposing internal notes. |
| `reports.resolved_at` | Needed to measure resolution time against `sla_due_at` (`met` / `missed`). `updated_at` is not safe — any later edit moves it. |
| `report_photos.is_hidden` | Staff can hide photos showing faces, number plates or private property (Privacy Act 2020). |

<a id="d-08"></a>
## D-08 — SLA hours are placeholders (Assumption — needs council confirmation)

- **Brief said:** "e.g., major road/meter leaks ≤12 hours, minor footpath/berm ≤3 days, etc."
- **Spec does:** A full 2 × 6 table (see `spec.md` §4). Major road/meter = 12 h and minor footpath/berm = 72 h, as in the brief. The other cells are our defaults.
  - Maps **major → urgent**, **minor → non-urgent**, matching the DIA *Non-Financial Performance Measures Rules 2013* that councils already report against.
  - Treats the hours as **resolution** targets, in calendar time, 24/7.
- **Why:** The brief gave examples, not a full table. Each council sets its own targets in its Long-Term Plan.
- **Action needed:** Get the real targets from each partner council. If they differ per council, add a per-council override (e.g. `councils.sla_overrides jsonb`) and record a new decision.

<a id="d-09"></a>
## D-09 — `geometry(Point,4326)` stored, `geography` for distance (Assumption)

- **Brief said:** "geom (PostGIS)", PostGIS index on geom, ST_DWithin within 30 m.
- **Spec does:** Store `geometry(Point,4326)` with a normal GIST index (for map bounding boxes) **and** an expression index on `(geom::geography)` (for metre distances).
- **Why:** `ST_DWithin` on plain 4326 geometry measures in **degrees**, not metres — a classic bug. Casting to geography gives metres. Keeping storage as geometry keeps zone polygons and map queries simple.
- **Alternative considered:** Store in NZTM2000 (EPSG:2193, metres). Rejected for v1: every input and output needs `ST_Transform`, and NZTM does not cover the Chatham Islands.
- **Code impact:** Distance queries must use exactly `geom::geography` or the index is not used.

<a id="d-10"></a>
## D-10 — Duplicate marking rules (Assumption)

- **Brief said:** `is_duplicate_of` nullable FK, set via `PATCH` by staff.
- **Spec does:**
  - The server never sets `is_duplicate_of` by itself. It only suggests (`possible_duplicates`, `nearby_open_count`).
  - No chains: the target must not itself be a duplicate.
  - The target must be in the same council.
  - When the parent is resolved or closed, the worker gives its duplicates the same status.
  - Duplicates are excluded from SLA statistics.
- **Why:** Two leaks 20 m apart can be real, separate faults. A person decides. No chains keeps queries one level deep.

<a id="d-11"></a>
## D-11 — Reject reports outside every council zone (Assumption — needs product-owner confirmation)

- **Brief said:** Council zone assignment by point-in-polygon. Behaviour when no zone matches: not stated.
- **Spec does:** `422 outside_service_area`. The PWA tells the reporter to contact their council directly. `council_zone_id` is `NOT NULL`.
- **Why:** An unassigned report alerts nobody and has no SLA owner. Telling the reporter now is more honest than storing a report no one will act on.
- **Alternative:** Accept with `council_zone_id = NULL` and alert a platform admin. Choose this if the project wants coverage data from non-partner areas.

<a id="d-12"></a>
## D-12 — Reporter personal information is private (Addition)

- **Brief said:** Fields `reporter_name`, `reporter_contact`. Visibility not stated.
- **Spec does:** Never returned on public responses. Returned only to staff of the council that owns the report.
- **Why:** Privacy Act 2020. The public map and nearby search are open to anyone.

<a id="d-13"></a>
## D-13 — Nearby-search behaviour (Assumption)

- **Brief said:** Find reports within ~30 m with `ST_DWithin`.
- **Spec does:**
  - Default 30 m; client may ask 10–200 m.
  - Effective radius = `max(radius_m, min(accuracy_m, 100))` — phone GPS is often worse than 30 m.
  - Includes reports resolved in the last 7 days ("is it leaking again?").
  - Does **not** filter by category — the same leak is often reported as berm by one person and footpath by another.
  - Excludes reports already marked as duplicates.

<a id="d-14"></a>
## D-14 — `bigint` ids shown as `WL-000123` (Assumption)

- **Brief said:** `id`. Type not stated.
- **Spec does:** `bigint GENERATED ALWAYS AS IDENTITY`. UI and messages show `WL-` + zero-padded id.
- **Why:** Short enough to read out over the phone or fit in an SMS. Reports are public, so guessable ids expose nothing private (D-12 protects the private fields).

<a id="d-15"></a>
## D-15 — Data residency (Addition — needs council confirmation)

- **Brief said:** Deploy on Railway.
- **Spec does:** Keeps Railway, but flags that Railway has no NZ region. Reporter contact details would be stored offshore.
- **Why:** Privacy Act 2020, IPP 12 (cross-border disclosure). Some councils have data-residency policies.
- **Action needed:** Confirm with each partner council before go-live.

<a id="d-16"></a>
## D-16 — Chatham Islands out of scope for v1 (Assumption)

- **Spec does:** Accepts lng 166…179 only. The Chathams sit near lng −176.5 (across the antimeridian), which needs special bounding-box handling.
- **Revisit:** If Chatham Islands Council joins.

<a id="d-17"></a>
## D-17 — Photo handling (Assumption)

- **Brief said:** "GPS + photo + category"; `photos[]` in the request.
- **Spec does:**
  - 0–3 photos, **optional**. The PWA strongly prompts for one.
  - Server re-encodes to webp (1600 px + 400 px thumbnail) with `sharp` and strips all EXIF.
  - Stored in an S3-compatible bucket, not on the server disk.
- **Why:**
  - Optional: some reporters cannot take a photo (night, no camera permission). A report without a photo beats no report.
  - EXIF strip: phone photos carry the GPS position, device and time; some are taken from the reporter's own property.
  - Bucket: Railway service disks are wiped on redeploy unless a volume is attached.

<a id="d-18"></a>
## D-18 — Monorepo `/backend` + `/frontend`, built by Windsurf SWE‑2 (Change — from the brief addendum)

- **Brief said (addendum):** Windsurf SWE‑2 implements the spec in a monorepo with `/backend` (Node/Express + PostGIS) and `/frontend` (React + Vite + Tailwind). Keep the spec implementation-ready for Windsurf.
- **Spec v0.1 had:** `apps/api` and `apps/web`, no CSS framework named.
- **Spec does now:**
  - `/backend` holds the API **and** the worker. They are one npm package with two start commands (`npm start`, `npm run worker`) and two Railway services.
  - `/frontend` is React + Vite + Tailwind + `vite-plugin-pwa`. Public reporting, public map and staff dashboard stay in this one app.
  - New `spec.md` §6: implementer rules, file tree, libraries, env vars, scripts, and a milestone list (M1–M11) with an acceptance check for each.
  - Choices we made inside the addendum:
    - **Backend in JavaScript (CommonJS)** — matches the §4 code and keeps the stack small for a junior.
    - **Frontend in TypeScript** — Vite's React template default; typed API client catches field-name mistakes.
    - `docker-compose.yml` at the root for local PostGIS + MinIO.
- **Why:** An AI implementer works best with explicit file paths, a fixed library list, small tasks, and a test for "done". Rule 1 in §6.1 ("do not invent") stops it filling gaps with guesses.
- **Open:** What happens to the current FastAPI MVP in `app/` and `static/` — see [`spec-vs-mvp.md`](spec-vs-mvp.md#open-decisions).
