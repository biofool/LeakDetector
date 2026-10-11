-- migrations/008_volunteer_verified.sql — volunteer email verification (#51).
-- New signups must click an emailed confirm link before they receive report
-- alerts, so an attacker can't flood a victim's inbox by signing them up.
-- Rows that predate verification are grandfathered as verified.
ALTER TABLE volunteers ADD COLUMN verified boolean NOT NULL DEFAULT false;
UPDATE volunteers SET verified = true;
DROP INDEX volunteers_zone_active_idx;
CREATE INDEX volunteers_zone_active_idx ON volunteers (council_zone_id) WHERE active AND verified;
