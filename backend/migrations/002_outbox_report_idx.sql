-- migrations/002_outbox_report_idx.sql — lookups/joins by report_id.
CREATE INDEX IF NOT EXISTS outbox_report_idx ON notification_outbox (report_id);
