-- migrations/006_backfill_status_history.sql — backfill report_status_history
-- for reports created before migration 003 existed (#36). One statement: for
-- every report with zero history rows, insert the 'received' bookend at
-- created_at and, when resolved_at is set, a terminal row at resolved_at.
-- Intermediate transitions are unrecoverable — only the bookends exist in the
-- data — so the second row's from_status is 'received' as best-effort.
-- changed_by stays NULL (unknown actor). Idempotent via the NOT EXISTS guard:
-- post-003 reports already have history and are untouched.
INSERT INTO report_status_history (report_id, from_status, to_status, changed_at)
SELECT r.id, NULL, 'received', r.created_at
FROM reports r
WHERE NOT EXISTS (
  SELECT 1 FROM report_status_history h WHERE h.report_id = r.id
)
UNION ALL
SELECT r.id, 'received',
       CASE WHEN r.status IN ('resolved', 'closed_private') THEN r.status::text ELSE 'resolved' END,
       r.resolved_at
FROM reports r
WHERE r.resolved_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM report_status_history h WHERE h.report_id = r.id
  );
