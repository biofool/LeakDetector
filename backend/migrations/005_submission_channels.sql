-- migrations/005_submission_channels.sql — per-council submission channel
-- (#35). The authority alert is routed through the council's preferred
-- intake channel; 'email' stays the universal baseline. channel_config
-- holds channel-specific fields: { sms_number, email_to, form_url,
-- field_map, api_creds_ref }.
ALTER TABLE councils
  ADD COLUMN submission_channel text NOT NULL DEFAULT 'email'
    CHECK (submission_channel IN ('email', 'sms', 'form_automation', 'vendor_api')),
  ADD COLUMN channel_config     jsonb NOT NULL DEFAULT '{}';
