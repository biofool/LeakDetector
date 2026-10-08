-- migrations/004_council_contacts.sql — first-class council contact channels
-- (#34). Emails stay on council_zones.alert_emails (the send target);
-- entity-level channel data lives on councils.
ALTER TABLE councils
  ADD COLUMN entity           text,  -- servicing body when not the council itself (e.g. Tiaki Wai, Watercare)
  ADD COLUMN contact_phone    text,  -- 24/7 urgent line, verbatim display string
  ADD COLUMN contact_form_url text,  -- online service-request form
  ADD COLUMN contact_app      text;  -- third-party intake app (Antenno, Snap Send Solve)
