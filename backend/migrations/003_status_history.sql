-- Report status audit trail [D-11]. One row per status change; reporters,
-- staff dashboards, and ops reviews can see when each transition happened
-- (intermediate steps were previously invisible — only created/resolved_at
-- were stored).
CREATE TABLE IF NOT EXISTS report_status_history (
  id          BIGSERIAL PRIMARY KEY,
  report_id   BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  from_status TEXT,                          -- NULL on the initial 'received' row
  to_status   TEXT NOT NULL,
  changed_by  UUID REFERENCES users(id),   -- NULL for public-driven changes
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_status_history_report_idx
  ON report_status_history (report_id, changed_at);
