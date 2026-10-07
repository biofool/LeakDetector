-- migrations/001_init.sql — schema verbatim from docs/spec.md §2
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
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE council_zones (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  council_id    int NOT NULL REFERENCES councils(id),
  name          text NOT NULL,
  boundary      geometry(MultiPolygon, 4326) NOT NULL,
  alert_emails  text[] NOT NULL DEFAULT '{}',
  alert_sms     text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (council_id, name)
);
CREATE INDEX council_zones_boundary_gix ON council_zones USING GIST (boundary);

-- Council staff (reporters are anonymous; no accounts)
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  password_hash  text NOT NULL,
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
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  geom                geometry(Point, 4326) NOT NULL,
  gps_accuracy_m      real,
  category            leak_location NOT NULL,
  location_type       leak_location NOT NULL,
  severity            leak_severity NOT NULL,
  description         text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  status              report_status NOT NULL DEFAULT 'received',
  public_note         text CHECK (char_length(public_note) <= 500),
  reporter_name       text CHECK (char_length(reporter_name) <= 100),
  reporter_contact    text CHECK (char_length(reporter_contact) <= 200),
  council_zone_id     int NOT NULL REFERENCES council_zones(id),
  sla_due_at          timestamptz NOT NULL,
  verified            boolean NOT NULL DEFAULT false,
  is_duplicate_of     bigint REFERENCES reports(id) ON DELETE SET NULL,
  confirmation_count  int NOT NULL DEFAULT 0,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_not_self_duplicate CHECK (is_duplicate_of IS NULL OR is_duplicate_of <> id)
);
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Spatial
CREATE INDEX reports_geom_gix  ON reports USING GIST (geom);
CREATE INDEX reports_geog_gix  ON reports USING GIST ((geom::geography));
-- Dashboard / filters
CREATE INDEX reports_zone_status_idx    ON reports (council_zone_id, status, created_at DESC);
CREATE INDEX reports_status_created_idx ON reports (status, created_at DESC);
CREATE INDEX reports_category_idx       ON reports (category);
CREATE INDEX reports_updated_idx        ON reports (updated_at);
CREATE INDEX reports_open_sla_idx       ON reports (sla_due_at)
  WHERE status IN ('received','investigating','contractor_assigned') AND is_duplicate_of IS NULL;
CREATE INDEX reports_dup_idx            ON reports (is_duplicate_of) WHERE is_duplicate_of IS NOT NULL;

CREATE TABLE report_photos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id     bigint NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  storage_key   text NOT NULL,
  thumb_key     text NOT NULL,
  content_type  text NOT NULL CHECK (content_type IN ('image/webp','image/jpeg')),
  width         int, height int, bytes int,
  uploaded_by   text NOT NULL DEFAULT 'reporter' CHECK (uploaded_by IN ('reporter','staff')),
  is_hidden     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_photos_report_idx ON report_photos (report_id);

-- Transactional outbox: API writes, worker sends [D-04]
CREATE TABLE notification_outbox (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id   bigint REFERENCES reports(id) ON DELETE CASCADE,
  channel     text NOT NULL CHECK (channel IN ('email','sms')),
  recipient   text NOT NULL,
  template    text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  dedupe_key  text UNIQUE,
  status      outbox_status NOT NULL DEFAULT 'pending',
  attempts    int NOT NULL DEFAULT 0,
  last_error  text,
  send_after  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending_idx ON notification_outbox (send_after) WHERE status = 'pending';
