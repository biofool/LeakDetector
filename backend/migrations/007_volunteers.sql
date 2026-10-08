-- migrations/007_volunteers.sql — volunteer "power users" (#37).
-- No accounts: email + unsubscribe token, matching the reporter model.
-- Contact details are staff-only — no public endpoint returns them.
CREATE TYPE volunteer_help AS ENUM ('hands_on', 'routing');

CREATE TABLE volunteers (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email              text NOT NULL CHECK (char_length(email) <= 200),
  council_zone_id    int NOT NULL REFERENCES council_zones(id),
  help_types         volunteer_help[] NOT NULL CHECK (array_length(help_types, 1) >= 1),
  note               text CHECK (char_length(note) <= 500),
  consent_staff_only boolean NOT NULL,  -- consent to staff-only contact sharing
  active             boolean NOT NULL DEFAULT true,
  unsubscribe_token  uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
-- One row per (email, zone): re-signup updates the row instead of duplicating.
CREATE UNIQUE INDEX volunteers_email_zone_uidx ON volunteers (lower(email), council_zone_id);
CREATE INDEX volunteers_zone_active_idx ON volunteers (council_zone_id) WHERE active;
CREATE TRIGGER volunteers_updated_at BEFORE UPDATE ON volunteers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
