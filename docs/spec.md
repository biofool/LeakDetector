# Water Leak Reporter — Technical Spec v0.1

> **Status:** target design, 2026-10-07. The code in this repo today is a
> FastAPI + SQLite MVP that does **not** yet match this spec — see
> [`spec-vs-mvp.md`](spec-vs-mvp.md). Every place this spec departs from the
> original [`brief.md`](brief.md) is explained in [`decisions.md`](decisions.md)
> and tagged inline as **[D-xx]**.
>
> **Implementer:** Windsurf SWE‑2, monorepo with `/backend` (Node/Express +
> PostGIS) and `/frontend` (React + Vite + Tailwind) **[D-18]**. Start at §6.

---

## 1. Architecture overview

### Components

| Component | Tech | Responsibility |
|---|---|---|
| **PWA** (`/frontend`) | React + Vite + Tailwind, `vite-plugin-pwa` | Public reporting flow (`/`), public map (`/map`), staff dashboard (`/staff`). One codebase. |
| **API** (`/backend`, `npm start`) | Node 20 + Express, `zod`, `pg`, `multer`, `sharp` | Validation, staff auth (JWT), all SQL, photo processing. Never sends email directly — writes to an outbox **[D-04]**. |
| **Worker** (`/backend`, `npm run worker`) | Node (same package as API) | Drains the notification outbox every 30 s; runs the SLA sweep every 5 min; cascades resolution to duplicates. **[D-04]** |
| **Database** | Postgres 16 + PostGIS | Reports, council zones, staff, outbox. Point-in-polygon zone lookup and 30 m duplicate search. |
| **Photo storage** | S3-compatible bucket (e.g. Cloudflare R2, AWS S3) | Resized, EXIF-stripped photos and thumbnails. **[D-17]** |
| **Email** | Postmark or AWS SES | Council alerts (reporter CC'd), SLA warnings, reporter receipts and "fixed" messages. Email only for reporter notifications — the SMS/Twilio path was dropped (#24). |
| **Council submission** | `councils.submission_channel` adapters [D-20] | Authority alerts route per council: `email` (Postmark, universal baseline), `sms` (generic HTTPS SMS gateway — e.g. Watercare 3130), `form_automation`/`vendor_api` reserved (consent-gated; fall back to email). The tracking page also offers a reporter-side `sms:` deep link so the reporter can text it in from their own phone. |

### Deployment (Railway)

- One Railway project, environments **production** and **staging**. Each has services `web`, `api`, `worker`, plus a Postgres plugin with PostGIS.
- Services deploy from one monorepo on push to `main` (production) or `staging` **[D-18]**. Root directory: `web` → `/frontend`; `api` and `worker` → `/backend` (same code, different start command).
- `api` pre-deploy command: `npm run migrate` (`node-pg-migrate`).
- File layout, scripts, local setup and build order: see §6.
- Secrets live in Railway variables only: `DATABASE_URL`, `JWT_SECRET`, `S3_*`, `POSTMARK_TOKEN`, `PUBLIC_BASE_URL`.
- **Data residency [D-15]:** Railway has no NZ region. Reporter contact details are personal information under the Privacy Act 2020 (IPP 12 covers sending it offshore). Confirm partner councils accept this before go-live.

```
 Reporter (phone)                                 Council staff
 PWA  /  /map                                     PWA  /staff
      │  HTTPS (JSON, multipart)                       │  HTTPS + Bearer JWT
      ▼                                                ▼
 ┌──────────────────────────────────────────────────────────┐     ┌────────────────┐
 │ api  (Express)                                           │────▶│ Photo bucket   │
 │ validate → zone lookup → SLA → insert report + outbox    │     └────────────────┘
 └───────────────────────────┬──────────────────────────────┘
                             │ SQL
 ┌───────────────────────────▼──────────────────────────────┐
 │ Postgres + PostGIS: reports, report_photos, councils,    │
 │ council_zones, users, notification_outbox                │
 └───────────────────────────▲──────────────────────────────┘
                             │ poll outbox (30 s) · SLA sweep (5 min)
 ┌───────────────────────────┴──────────────────────────────┐
 │ worker                                                   │────▶ Email (Postmark/SES)
 └──────────────────────────────────────────────────────────┘
```

### Data flow — one leak report, submission to resolution

1. **Locate.** The reporter opens the PWA. The browser returns `lat`, `lng`, `accuracy`. The reporter can drag the pin to correct it.
2. **Duplicate check.** The PWA calls `GET /reports/nearby`. If open reports exist within ~30 m, it shows them first. The reporter taps **"Yes, I've seen this one too"** (`POST /reports/:id/confirm` **[D-06]**, flow ends) or **"No, mine's different"**. See §5.
3. **Submit.** Category, severity, 0–3 photos (compressed in the browser to ≤ 2 MB), description, optional name and contact. The PWA sends `POST /reports` as multipart.
4. **API.**
   1. Validate the input.
   2. Find the council zone with `ST_Covers`. No zone → `422` **[D-11]**.
   3. `computeSLA()` → `sla_due_at`.
   4. Resize photos, strip EXIF, upload to the bucket.
   5. In **one transaction**: insert the report, the photos, and outbox rows (email to the zone, CC'ing the reporter when `reporter_contact` is an email; receipt to the reporter when the contact is an email).
   6. Return `201` with reference and tracking URL.
5. **Alert.** The worker claims pending outbox rows (`FOR UPDATE SKIP LOCKED`) and sends them. It retries with backoff up to 5 times, then marks the row `failed` and logs at ERROR.
6. **Triage.** The staff dashboard polls `GET /reports?updated_since=…` every 30 s, sorted by `sla_due_at`. Staff verify, mark duplicates, and advance the status with `PATCH /reports/:id`.
7. **SLA sweep.** Every 5 min the worker finds open reports that are `due_soon` or `breached` and writes one outbox row per report, alert type and recipient. A unique `dedupe_key` stops repeat alerts.
8. **Resolve.** Staff set `status=resolved`, or `closed_private` when the leak is on the owner's side of the toby/meter. The API sets `resolved_at`; the worker resolves any duplicates. The reporter gets a "fixed" or "private property — contact the owner or a plumber" message. The public map shows resolved reports for 7 days.

---

## 2. Data model (PostGIS)

**Read first**
- `category` and `location_type` use the **same enum** **[D-02]**. `category` = what the reporter chose; never edited. `location_type` = starts as a copy of `category`; staff correct it after inspection. **SLA uses `location_type`.**
- `geom` is `geometry(Point, 4326)`. Distance queries cast to `geography` so units are metres; an expression index covers the cast **[D-09]**.
- **`ST_MakePoint(lng, lat)` — longitude first.** Getting this backwards is the most common bug.

```sql
-- migrations/001_init.sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE leak_location  AS ENUM ('footpath','berm','road','water_meter','outside_tap','other_public');
CREATE TYPE leak_severity  AS ENUM ('major','minor');
CREATE TYPE report_status  AS ENUM ('received','investigating','contractor_assigned','resolved','closed_private');
CREATE TYPE staff_role     AS ENUM ('council_staff','council_admin','platform_admin');
CREATE TYPE outbox_status  AS ENUM ('pending','sent','failed');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$ LANGUAGE plpgsql;

-- Councils / water organisations [D-03]
CREATE TABLE councils (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL UNIQUE,                       -- 'Wellington City Council'
  entity           text,                                  -- servicing body (e.g. Tiaki Wai, Watercare) [#34]
  contact_phone    text,
  contact_form_url text,
  contact_app      text,
  submission_channel text NOT NULL DEFAULT 'email',       -- 'email'|'sms'|'form_automation'|'vendor_api' [D-20]
  channel_config     jsonb NOT NULL DEFAULT '{}',         -- {sms_number, email_to, form_url, field_map, api_creds_ref}
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE council_zones (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  council_id    int NOT NULL REFERENCES councils(id),
  name          text NOT NULL,                            -- 'Central', 'Northern suburbs'
  boundary      geometry(MultiPolygon, 4326) NOT NULL,
  alert_emails  text[] NOT NULL DEFAULT '{}',
  alert_sms     text[] NOT NULL DEFAULT '{}',             -- legacy, unused since #24 (email-only); pending drop
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (council_id, name)
);
CREATE INDEX council_zones_boundary_gix ON council_zones USING GIST (boundary);

-- Council staff (reporters are anonymous; no accounts)
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  password_hash  text NOT NULL,                           -- argon2id or bcrypt
  display_name   text NOT NULL,
  role           staff_role NOT NULL DEFAULT 'council_staff',
  council_id     int REFERENCES councils(id),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_council_required CHECK (role = 'platform_admin' OR council_id IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_uidx ON users (lower(email));
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Leak reports
CREATE TABLE reports (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- shown as WL-000123 [D-14]
  geom                geometry(Point, 4326) NOT NULL,
  gps_accuracy_m      real,                               -- [D-07]
  category            leak_location NOT NULL,             -- reporter's choice, never edited
  location_type       leak_location NOT NULL,             -- defaults to category; staff may correct
  severity            leak_severity NOT NULL,
  description         text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  status              report_status NOT NULL DEFAULT 'received',
  public_note         text CHECK (char_length(public_note) <= 500),     -- [D-07] staff message shown publicly
  reporter_name       text CHECK (char_length(reporter_name) <= 100),   -- PRIVATE [D-12]
  reporter_contact    text CHECK (char_length(reporter_contact) <= 200),-- PRIVATE: email or E.164 mobile
  council_zone_id     int NOT NULL REFERENCES council_zones(id),        -- NOT NULL [D-11]
  sla_due_at          timestamptz NOT NULL,
  verified            boolean NOT NULL DEFAULT false,
  is_duplicate_of     bigint REFERENCES reports(id) ON DELETE SET NULL,
  confirmation_count  int NOT NULL DEFAULT 0,             -- "I've seen it too" taps [D-06]
  resolved_at         timestamptz,                        -- set on resolved OR closed_private [D-07]
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_not_self_duplicate CHECK (is_duplicate_of IS NULL OR is_duplicate_of <> id)
);
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Spatial
CREATE INDEX reports_geom_gix  ON reports USING GIST (geom);                -- map bbox queries
CREATE INDEX reports_geog_gix  ON reports USING GIST ((geom::geography));   -- ST_DWithin in metres
-- Dashboard / filters
CREATE INDEX reports_zone_status_idx    ON reports (council_zone_id, status, created_at DESC);
CREATE INDEX reports_status_created_idx ON reports (status, created_at DESC);
CREATE INDEX reports_category_idx       ON reports (category);
CREATE INDEX reports_updated_idx        ON reports (updated_at);            -- dashboard polling
CREATE INDEX reports_open_sla_idx       ON reports (sla_due_at)
  WHERE status IN ('received','investigating','contractor_assigned') AND is_duplicate_of IS NULL;
CREATE INDEX reports_dup_idx            ON reports (is_duplicate_of) WHERE is_duplicate_of IS NOT NULL;

CREATE TABLE report_photos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id     bigint NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  storage_key   text NOT NULL,                            -- 'reports/1043/3f9c….webp'
  thumb_key     text NOT NULL,
  content_type  text NOT NULL CHECK (content_type IN ('image/webp','image/jpeg')),
  width         int, height int, bytes int,
  uploaded_by   text NOT NULL DEFAULT 'reporter' CHECK (uploaded_by IN ('reporter','staff')),
  is_hidden     boolean NOT NULL DEFAULT false,           -- staff moderation (faces, plates) [D-07]
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_photos_report_idx ON report_photos (report_id);

-- Transactional outbox: API writes, worker sends [D-04]
CREATE TABLE notification_outbox (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id   bigint REFERENCES reports(id) ON DELETE CASCADE,
  channel     text NOT NULL CHECK (channel IN ('email','sms')),   -- 'sms' legacy only — new rows are always 'email'
  recipient   text NOT NULL,
  template    text NOT NULL,      -- new_report | sla_due_soon | sla_breached | reporter_receipt | reporter_resolved | reporter_private
  payload     jsonb NOT NULL DEFAULT '{}',
  dedupe_key  text UNIQUE,        -- e.g. 'sla_breached:1043:ops@council.govt.nz'
  status      outbox_status NOT NULL DEFAULT 'pending',
  attempts    int NOT NULL DEFAULT 0,
  last_error  text,
  send_after  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending_idx ON notification_outbox (send_after) WHERE status = 'pending';
```

### Key queries

```sql
-- Zone lookup (smallest zone wins when zones overlap)
SELECT z.id, z.name, z.council_id
FROM council_zones z
WHERE ST_Covers(z.boundary, ST_SetSRID(ST_MakePoint($1 /*lng*/, $2 /*lat*/), 4326))
ORDER BY ST_Area(z.boundary) ASC
LIMIT 1;

-- Insert
INSERT INTO reports (geom, gps_accuracy_m, category, location_type, severity, description,
                     reporter_name, reporter_contact, council_zone_id, sla_due_at)
VALUES (ST_SetSRID(ST_MakePoint($lng, $lat), 4326), $acc, $cat, $cat, $sev, $desc,
        $name, $contact, $zoneId, $slaDueAt)
RETURNING id, created_at;

-- Worker: claim a batch
SELECT * FROM notification_outbox
WHERE status = 'pending' AND send_after <= now()
ORDER BY id LIMIT 20
FOR UPDATE SKIP LOCKED;
-- on failure: attempts+1, send_after = now() + (2^attempts) minutes; after 5 → status='failed', log ERROR
```

Later: a `report_events` audit table (report_id, user_id, field, old, new, at) for council reporting.

---

## 3. API spec

**Base URL:** `/api/v1`. **Format:** JSON, except `POST /reports` (`multipart/form-data`). **Times:** ISO 8601 UTC; the UI shows `Pacific/Auckland`.
**Auth:** public endpoints need no token. Staff endpoints need `Authorization: Bearer <JWT>` (8 h expiry) **[D-05]**. Staff see and change only reports in their own council's zones; `platform_admin` sees all.
**Privacy [D-12]:** `reporter_name` and `reporter_contact` are returned **only** to staff of the owning council.
**Express gotchas:** register `/reports/nearby` **before** `/reports/:id`. Set `app.set('trust proxy', 1)` — Railway runs behind a proxy and rate limiting needs the real client IP.

**Error shape (all endpoints)**
```json
{ "error": { "code": "validation_failed", "message": "lat must be between -48 and -34",
             "details": [{ "field": "lat", "issue": "out_of_range" }] } }
```

**Report object**
```json
{
  "id": 1042,
  "ref": "WL-001042",
  "category": "berm",
  "location_type": "berm",
  "severity": "minor",
  "status": "investigating",
  "description": "Water bubbling up through the berm outside no. 14. Going for 2 days.",
  "public_note": "Crew booked for Thursday morning.",
  "lat": -41.29241,
  "lng": 174.77683,
  "council_zone": { "id": 3, "name": "Central", "council": "Wellington City Council" },
  "verified": true,
  "is_duplicate_of": null,
  "confirmation_count": 2,
  "sla_due_at": "2026-10-10T01:12:44Z",
  "sla_status": "on_track",
  "photos": [{ "id": 77, "url": "https://img.example.nz/reports/1042/a1.webp",
               "thumb_url": "https://img.example.nz/reports/1042/a1_t.webp" }],
  "resolved_at": null,
  "created_at": "2026-10-07T01:12:44Z",
  "updated_at": "2026-10-07T03:40:02Z"
}
```
Staff view adds `reporter_name`, `reporter_contact`, `gps_accuracy_m`. `sla_status` is computed in code (§4), never stored.

---

### `POST /auth/login` — public [D-05]
Request `{ "email": "j.smith@council.govt.nz", "password": "…" }`
Response `200 { "token": "eyJ…", "user": { "id": "…", "display_name": "J Smith", "role": "council_staff", "council_id": 2 } }`. `401` on bad credentials. Rate limit: 10 per 15 min per IP.

---

### `POST /reports` — public, 5 per hour per IP
Body is `multipart/form-data`.

| Field | Type | Rules |
|---|---|---|
| `category` | enum | `footpath`, `berm`, `road`, `water_meter`, `outside_tap`, `other_public` |
| `severity` | enum | `major`, `minor` |
| `description` | string | 0–1000 chars |
| `lat`, `lng` | number | lat −48…−34, lng 166…179 (Chatham Islands out of scope for v1 **[D-16]**) |
| `accuracy_m` | number? | From the browser geolocation API **[D-07]** |
| `reporter_name` | string? | ≤ 100 chars |
| `reporter_contact` | string? | Email, or NZ mobile `^(\+?64\|0)2\d{7,9}$`, stored as E.164 `+642…` |
| `photos[]` | file × 0–3 | jpeg/png/webp/heic, ≤ 8 MB each. Server re-encodes to webp (1600 px + 400 px thumb) and strips EXIF **[D-17]** |

The brief lists `location_type` in the request body. It is **not** accepted from the reporter; it is copied from `category` **[D-02]**.

Example (fields shown as JSON):
```json
{ "category": "road", "severity": "major",
  "description": "Water gushing from a crack in the seal, running down the gutter.",
  "lat": -36.85231, "lng": 174.76332, "accuracy_m": 8,
  "reporter_name": "Aroha", "reporter_contact": "021 555 0199" }
```
Response `201`:
```json
{ "id": 1043, "ref": "WL-001043", "status": "received",
  "council_zone": { "id": 7, "name": "Auckland CBD", "council": "Auckland Council" },
  "sla_due_at": "2026-10-07T13:20:11Z",
  "tracking_url": "https://leaks.example.nz/r/1043",
  "possible_duplicates": [ { "id": 1039, "distance_m": 21.7, "status": "received" } ] }
```
Errors: `400` validation · `413` photo too large · `415` unsupported type · `422 outside_service_area` (no zone covers the point; the PWA shows "Contact your council directly") **[D-11]**.

---

### `GET /reports/nearby?lat=&lng=&radius_m=&accuracy_m=` — public, 60 per min per IP
Candidate duplicates for the pre-submit check **[D-13]**.
- `radius_m` defaults to 30, clamped to 10–200.
- Effective radius = `max(radius_m, min(accuracy_m, 100))`.
- At most 10 results, nearest first.

Response `200`:
```json
{ "radius_m": 30,
  "results": [
    { "id": 1042, "ref": "WL-001042", "category": "berm", "severity": "minor",
      "status": "investigating", "distance_m": 18.4, "confirmation_count": 2,
      "created_at": "2026-10-07T01:12:44Z", "resolved_at": null,
      "thumb_url": "https://img.example.nz/reports/1042/a1_t.webp" } ] }
```

---

### `GET /reports/:id` — public (staff get private fields)
`200` → report object. Hidden photos are left out for public callers. `404` if not found.

---

### `POST /reports/:id/confirm` — public, 10 per hour per IP [D-06]
"I've seen it too". Adds 1 to `confirmation_count`.
`200 { "id": 1042, "confirmation_count": 3 }` · `409` if the report is already resolved.

---

### `PATCH /reports/:id` — staff
Send only the fields that change.

| Field | Notes |
|---|---|
| `status` | Must be an allowed transition (below). `resolved` / `closed_private` set `resolved_at = now()` and queue a reporter message. |
| `severity`, `location_type` | Change → recalculate `sla_due_at = computeSLA(severity, location_type, created_at)`. |
| `verified` | boolean |
| `is_duplicate_of` | id or `null`. Target must be in the same council and must not itself be a duplicate (no chains) **[D-10]**. |
| `public_note` | ≤ 500 chars, shown on the public map. |

Allowed status transitions:

| From | To |
|---|---|
| `received` | `investigating`, `contractor_assigned`, `resolved`, `closed_private` |
| `investigating` | `contractor_assigned`, `resolved`, `closed_private` |
| `contractor_assigned` | `investigating`, `resolved`, `closed_private` |
| `resolved`, `closed_private` | `investigating` (reopen; clears `resolved_at`) |

Request:
```json
{ "status": "contractor_assigned", "verified": true, "public_note": "Crew booked for 2 pm today." }
```
`200` → full report (staff view). Errors: `401` no token · `403` other council · `409 invalid_transition` · `422 invalid_duplicate_target`.

---

### `GET /reports` — public (staff get private fields)

| Param | Notes |
|---|---|
| `status` | Comma-separated, e.g. `received,investigating` |
| `category`, `severity` | Single or comma-separated |
| `council_zone_id` | int |
| `sla` | `on_track`, `due_soon`, `breached` (open reports only) |
| `bbox` | `minLng,minLat,maxLng,maxLat` (map viewport) |
| `updated_since` | ISO time, for 30 s dashboard polling |
| `include_duplicates` | default `false` |
| `sort` | `sla_due_at` (staff default) or `-created_at` (public default) |
| `page`, `limit` | `limit` default 50, max 200 |
| `format` | `json` (default) or `geojson` (FeatureCollection for Leaflet/MapLibre) |

Public default hides resolved reports older than 7 days.

Example: `GET /reports?status=received,investigating&council_zone_id=3&sla=breached`
```json
{ "page": 1, "limit": 50, "total": 2,
  "results": [ { "id": 1031, "ref": "WL-001031", "category": "water_meter", "severity": "major",
                 "status": "received", "sla_due_at": "2026-10-06T22:00:00Z", "sla_status": "breached",
                 "lat": -41.2871, "lng": 174.7762, "confirmation_count": 0, "verified": false,
                 "nearby_open_count": 1, "created_at": "2026-10-06T10:00:00Z" } ] }
```
`nearby_open_count` is staff-only. It flags possible duplicates (§5).

---

## 4. SLA rules

**Basis [D-08].** Councils report median attendance and resolution times for urgent and non-urgent call-outs under the DIA *Non-Financial Performance Measures Rules 2013*. This app maps **major → urgent** and **minor → non-urgent**. The hours below are **resolution targets and placeholder defaults**. Replace them with each partner council's Long-Term Plan targets before go-live. The clock runs 24/7 in calendar time.

| location_type | major | minor |
|---|---|---|
| `road` | **12 h** | 48 h |
| `water_meter` | **12 h** | 72 h (3 days) |
| `footpath` | 24 h | 72 h (3 days) |
| `berm` | 24 h | 72 h (3 days) |
| `other_public` | 24 h | 120 h (5 days) |
| `outside_tap` | 48 h | 120 h (5 days) |

**Severity guidance for reporters (PWA copy)**
- **Major:** water gushing or spraying; flowing across the road or footpath; flooding a property; a hole or sinking in the road; the street has lost pressure.
- **Minor:** a steady trickle; damp or boggy berm; pooling water; a dripping meter or tap.

**Code.** The brief's signature is `computeSLA(category, location_type, created_at)`. This spec uses `severity` instead of `category` **[D-01]**.

```js
// src/sla.js
const HOUR = 3_600_000;

const SLA_HOURS = {
  major: { road: 12, water_meter: 12, footpath: 24, berm: 24, other_public: 24, outside_tap: 48 },
  minor: { road: 48, water_meter: 72, footpath: 72, berm: 72, other_public: 120, outside_tap: 120 },
};

function computeSLA(severity, locationType, createdAt) {
  const hours = SLA_HOURS[severity]?.[locationType];
  if (hours === undefined) {
    throw new Error(`No SLA rule for severity=${severity} location_type=${locationType}`);
  }
  return new Date(createdAt.getTime() + hours * HOUR);
}

// on_track | due_soon | breached | met | missed | n/a
function slaStatus(r, now = new Date()) {
  if (r.is_duplicate_of || r.status === 'closed_private') return 'n/a';
  if (r.status === 'resolved') return r.resolved_at <= r.sla_due_at ? 'met' : 'missed';
  const left = r.sla_due_at - now;
  if (left < 0) return 'breached';
  const window = Math.min(2 * HOUR, 0.25 * (r.sla_due_at - r.created_at));
  return left <= window ? 'due_soon' : 'on_track';
}

module.exports = { computeSLA, slaStatus, SLA_HOURS };
```

**SQL equivalents** (for the `sla=` filter and the worker sweep; "open" = status in `received`, `investigating`, `contractor_assigned` and `is_duplicate_of IS NULL`):
```sql
-- breached
sla_due_at < now()
-- due_soon
sla_due_at >= now()
AND sla_due_at - now() <= LEAST(interval '2 hours', (sla_due_at - created_at) * 0.25)
```

**Rules**
- `sla_due_at` is set on create. It is recalculated from `created_at` when staff change `severity` or `location_type`.
- Duplicates and `closed_private` reports are excluded from SLA statistics.
- The sweep sends each alert once per report and recipient (`dedupe_key` = `sla_due_soon:<id>:<recipient>` / `sla_breached:<id>:<recipient>`).
- `due_soon` and `breached` go by email to the zone.

---

## 5. Duplicate detection

### Query (used by `GET /reports/nearby`, the post-submit re-check, and staff `nearby_open_count`)

```sql
SELECT r.id, r.category, r.severity, r.status, r.created_at, r.resolved_at, r.confirmation_count,
       ST_Distance(r.geom::geography,
                   ST_SetSRID(ST_MakePoint($1 /*lng*/, $2 /*lat*/), 4326)::geography) AS distance_m,
       (SELECT p.thumb_key FROM report_photos p
         WHERE p.report_id = r.id AND NOT p.is_hidden ORDER BY p.id LIMIT 1)       AS thumb_key
FROM reports r
WHERE ST_DWithin(r.geom::geography,
                 ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                 $3 /*radius metres*/)
  AND r.is_duplicate_of IS NULL
  AND ( r.status IN ('received','investigating','contractor_assigned')
        OR r.resolved_at > now() - interval '7 days' )
  AND ($4::bigint IS NULL OR r.id <> $4)            -- exclude self (staff view)
ORDER BY distance_m
LIMIT 10;
```
- `ST_DWithin` on `geography` works in metres and uses `reports_geog_gix`. **The cast must match the index exactly: `geom::geography`.**
- Includes reports resolved in the last 7 days — "fixed yesterday, leaking again today" matters **[D-13]**.
- No category filter — people pick different categories for the same leak (berm vs footpath across a kerb) **[D-13]**.

### Reporter UX (before final submission)

1. **After the pin is confirmed** (before category/photo/description), call `/reports/nearby` with the browser's `accuracy_m`.
2. **No results** → go straight to the form.
3. **Results** → bottom sheet **"Is this the leak you're reporting?"**, one card per result:
   - Thumbnail, category, status badge, "Reported 3 hours ago", "18 m away", "Seen by 2 others".
   - Small map with your pin and the existing pins.
   - **"Yes, that's it"** → `POST /reports/:id/confirm` → "Thanks — the council already knows. Track it here →". Flow ends.
   - **"No, mine's different"** → continue to the form.
   - A `resolved` result shows **"Fixed recently — is it leaking again?"**; its main button continues to a new report.
4. **On submit**, the server re-runs the 30 m query (another report may have arrived). It **does not block** and does **not** set `is_duplicate_of` **[D-10]**. It returns `possible_duplicates` in the `201` for information.

### Staff UX

- Rows with `nearby_open_count > 0` show a **"Possible duplicate"** badge. Opening the row lists the nearby reports from the same query.
- **"Mark as duplicate of WL-00xxxx"** → `PATCH { "is_duplicate_of": <id> }`. The API rejects chains and cross-council targets. The duplicate leaves the default list and SLA statistics; its photos show on the parent.
- When the parent becomes `resolved` or `closed_private`, the worker applies the same status to all its duplicates and queues "fixed" messages to their reporters.

---

## 6. Implementation guide (Windsurf SWE-2)

This section turns §1–5 into files and tasks **[D-18]**. Work through §6.6 one
milestone at a time. Each milestone has a check that must pass before the next
one starts.

### 6.1 Rules for the implementer

1. **Do not invent.** No new endpoints, fields, enum values or tables beyond §2–3. If something is missing, stop and add a proposed entry to `docs/decisions.md`.
2. **`ST_MakePoint(lng, lat)`** — longitude first, everywhere.
3. **Parameterised SQL only** (`pg` with `$1…`). No ORM, no string-built SQL.
4. **Never fail silently.** No empty `catch`. Log every caught error with `pino` at `warn` or `error`, with a specific message.
5. **One serialiser per audience.** `toPublicReport(row)` and `toStaffReport(row)` in `backend/src/serializers.js`. Only `toStaffReport` may output `reporter_name`, `reporter_contact`, `gps_accuracy_m` **[D-12]**.
6. **Enums are defined once per package:** `backend/src/constants.js` and `frontend/src/lib/constants.ts`. They must match §2 exactly.
7. **Times:** UTC `timestamptz` in the database, ISO 8601 UTC in the API, `Pacific/Auckland` only in the UI.
8. **UI copy uses NZ English** (footpath, berm, metres, organisation).
9. **Secrets** come from environment variables only. Commit `.env.example`, never `.env`.

### 6.2 Repo layout

```
/
├── backend/                     Node 20, JavaScript (CommonJS)
│   ├── package.json
│   ├── .env.example
│   ├── migrations/
│   │   └── 001_init.sql         §2 verbatim
│   ├── scripts/seed.js          test council, zone, staff user
│   ├── src/
│   │   ├── server.js            starts HTTP listener
│   │   ├── app.js               builds Express app (exported for tests)
│   │   ├── worker.js            outbox drain (30 s) + SLA sweep (5 min)
│   │   ├── config.js            reads env with zod; exits on missing required vars
│   │   ├── db.js                pg Pool
│   │   ├── constants.js         enums, limits, rate limits
│   │   ├── sla.js               §4 verbatim
│   │   ├── serializers.js       toPublicReport / toStaffReport
│   │   ├── schemas/             zod request schemas, one file per route group
│   │   ├── middleware/          auth.js, rateLimit.js, errorHandler.js
│   │   ├── routes/              auth.js, reports.js
│   │   └── services/            zones.js, duplicates.js, photos.js, storage.js,
│   │                            outbox.js, notify/email.js
│   └── test/                    vitest + supertest
├── frontend/                    React 18 + Vite + Tailwind, TypeScript
│   ├── package.json
│   ├── .env.example
│   ├── vite.config.ts           incl. vite-plugin-pwa
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx, App.tsx    react-router routes below
│       ├── api/client.ts        typed fetch wrapper; adds JWT for staff
│       ├── lib/                 constants.ts, format.ts (NZ dates, WL- refs)
│       ├── components/          PinPicker, DuplicateSheet, PhotoInput,
│       │                        StatusBadge, SlaBadge, ReportCard, MapView
│       └── pages/               Report, Track, PublicMap,
│                                staff/Login, staff/Dashboard, staff/ReportDetail
├── docker-compose.yml           local Postgres+PostGIS and MinIO
└── docs/
```

Frontend routes: `/` Report · `/r/:id` Track · `/map` PublicMap · `/staff/login` · `/staff` Dashboard · `/staff/reports/:id` ReportDetail.

### 6.3 Libraries

| Package | Libraries |
|---|---|
| backend | `express`, `pg`, `zod`, `multer` (memory storage, 8 MB, 3 files), `sharp`, `@aws-sdk/client-s3`, `jsonwebtoken`, `argon2`, `express-rate-limit`, `helmet`, `cors`, `pino`, `pino-http`, `node-pg-migrate`, `postmark`; dev: `vitest`, `supertest` |
| frontend | `react-router-dom`, `@tanstack/react-query` (30 s polling via `refetchInterval`), `leaflet` + `react-leaflet`, `browser-image-compression`, `tailwindcss`, `vite-plugin-pwa`; dev: `vitest`, `@testing-library/react` |

Map tiles: LINZ Basemaps (NZ government, free API key) or another provider that allows production use. Do not use `tile.openstreetmap.org` for production traffic — its usage policy forbids heavy use.

### 6.4 Environment variables

| Var | Package | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | backend | yes | Railway Postgres |
| `JWT_SECRET` | backend | yes | ≥ 32 random bytes |
| `CORS_ORIGIN` | backend | yes | The frontend URL, e.g. `https://leaks.example.nz` |
| `PUBLIC_BASE_URL` | backend | yes | Used in tracking links and messages |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | backend | yes | MinIO locally |
| `POSTMARK_TOKEN`, `EMAIL_FROM` | backend (worker) | no | Unset → worker logs WARNING and leaves email rows `pending` |
| `ALERT_FALLBACK_EMAIL` | backend | no | Authority-alert recipient for zones whose `alert_emails` is empty |
| `VITE_API_BASE_URL` | frontend | yes | e.g. `https://api.leaks.example.nz/api/v1` |
| `VITE_BASEMAP_URL` | frontend | yes | Tile URL template incl. key |

### 6.5 Scripts

| Package | Script | Does |
|---|---|---|
| backend | `npm run dev` | API with `node --watch` |
| backend | `npm start` | API (Railway `api` service) |
| backend | `npm run worker` | Worker (Railway `worker` service) |
| backend | `npm run migrate` | `node-pg-migrate up` |
| backend | `npm run seed` | Test council "Wellington City Council", zone "Central" (polygon around the CBD), staff user from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` |
| backend | `npm test` | vitest against the docker-compose database |
| frontend | `npm run dev` / `build` / `preview` / `test` | Vite defaults |

Local setup: `docker compose up -d` → `cd backend && cp .env.example .env && npm i && npm run migrate && npm run seed && npm run dev` → in another shell `cd frontend && cp .env.example .env && npm i && npm run dev`.

### 6.6 Build order and acceptance checks

| # | Milestone | Done when |
|---|---|---|
| M1 | Backend skeleton: config, db, migration 001, seed, `GET /healthz` | `npm run migrate` succeeds on an empty DB; `/healthz` returns `200 {"db":"ok"}` |
| M2 | `sla.js` + unit tests | Every cell of the §4 table is tested; `due_soon` / `breached` boundaries tested |
| M3 | `POST /reports` (no photos), zone lookup, `GET /reports/:id` | Point inside seeded zone → `201`; point in Auckland → `422 outside_service_area`; public GET has no `reporter_*` fields |
| M4 | `GET /reports/nearby`, `POST /reports/:id/confirm` | Report 20 m away is returned, 40 m away is not; confirm on a resolved report → `409` |
| M5 | Photos: multer → sharp → S3 | Uploaded JPEG comes back as webp with no EXIF (check with `exiftool`); 4th file → `400` |
| M6 | `POST /auth/login`, auth middleware, `PATCH /reports/:id`, `GET /reports` filters | Every transition in §3 tested, allowed and refused; staff of council A get `403` on council B |
| M7 | Outbox writes + worker + SLA sweep | New report creates 1 email row per zone recipient (reporter CC'd via `payload.cc`); a sweep run twice creates no extra rows; a failing provider moves a row to `failed` after 5 attempts |
| M8 | Frontend: Report flow (pin → duplicate sheet → form → success) | Works on a 360 px wide screen; "Yes, that's it" calls confirm and ends the flow |
| M9 | Frontend: Track page and public map | Map shows open + 7-day resolved reports; no personal data in network responses |
| M10 | Frontend: staff dashboard | Sorted by `sla_due_at`; 30 s polling; SLA and "Possible duplicate" badges; PATCH actions |
| M11 | Railway deploy (staging then production) | Pre-deploy migration runs; a real report on staging produces a real email |

---

### 6.7 As-built deltas (what was actually implemented)

The implementation followed the §6.2 layout and every behavioural rule, but
the build prompt specified **TypeScript + ESM** for the backend, which wins
over the §6.2 CommonJS note. Recorded deltas:

| Spec §6 | As built |
|---|---|
| Backend JavaScript (CommonJS) | Backend **TypeScript, ESM** (`tsx` dev, `tsc` build → `dist/src`) |
| `node-pg-migrate` | `src/migrate.ts` — applies `migrations/*.sql` with a `schema_migrations` ledger; `npm run migrate` / `start:migrate` |
| `express-rate-limit` | `middleware/rateLimit.ts` — in-memory fixed window, per-route buckets |
| `pino`, `pino-http`, `helmet` | `console.*` logging + request-log middleware; no helmet yet (API-only) |
| `postmark` SDK | `services/outbox.ts` calls the Postmark REST API via `fetch` — zero extra deps |
| `docker-compose.yml` + MinIO | Docker `postgis/postgis` container; photos fall back to local `data/uploads` when `S3_*` unset |
| `test/` + vitest | `tests/` + **Jest** + supertest |
| `constants.js`, `serializers.js`, `server.js` | `types.ts`, `util/serialize.ts` (`toReport(row, photos, staff)`), `index.ts` |
| `/staff/login`, `/staff/reports/:id` | `/staff` only — inline login + expandable rows |
| `react-leaflet`, `@tanstack/react-query`, `browser-image-compression` | Plain `leaflet` wrapper (divIcon), manual 30 s polling, server-side sharp only |
| `EMAIL_FROM`, `CORS_ORIGIN`, `VITE_BASEMAP_URL` | `POSTMARK_FROM`; `cors()` open for now; OSM tiles in dev (LINZ noted for prod). Added `API_PUBLIC_URL` for absolute photo URLs |

Additions beyond §3 that were required by review: `PATCH
/reports/:id/photos/:photoId` (staff photo moderation, completes D-07) and
`GET /healthz`.

Notes:
- Photos accept jpeg/png/webp. heic is in §3 but the stock `sharp` build has
  no libheif — the API returns `415` until a council asks for it.
- `DISABLE_RATE_LIMIT=1` exists for the test suite only.
