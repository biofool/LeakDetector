# E2E test plan — report → staff workflow → reporter notification

Target: `backend/` (Node/Express + PostGIS), not `legacy/` (FastAPI MVP).

## Environment

- PostGIS container `leakdetector-postgis` on `127.0.0.1:5433`
  (`docker run` already done; DB `leakdetector`, migrated + seeded).
- Seed provides: `Demo City Council` → `Citywide` zone covering the whole
  NZ mainland bbox, `alert_emails={duty@example.govt.nz}`, staff login
  `staff@example.govt.nz` / `password123` (council_admin).
- API: `npx tsx src/index.ts` on :8080 → `logs/api.log`
- Worker: `npx tsx src/worker.ts` (outbox drain 30 s, SLA sweep 5 min)
  → `logs/worker.log`
- Log monitor: `tail -F logs/api.log logs/worker.log` watching for
  `error|warn|failed` — any hit during the run is ticketed + fixed.

## Steps

1. **Random location.** Pick a random point inside the NZ bbox
   (lat −47…−35, lng 167…178) so `zoneForPoint` resolves to `Citywide`.
2. **One report per severity.** `POST /api/v1/reports` twice (multipart):
   `severity=major` and `severity=minor`, each with a photo and a distinct
   `reporter_contact` email. Expect 201 + `ref` + `sla_due_at`.
3. **Confirm recorded.** `GET /api/v1/reports/{id}` returns the row;
   DB `reports` has the rows; worker log shows outbox drain of
   `new_report` → duty officer and `reporter_receipt` → reporter.
4. **Management API workflow.** `POST /api/v1/auth/login` → JWT.
   `PATCH /api/v1/reports/{id}` for the *major* report through
   `received → investigating → contractor_assigned → resolved`.
   Negative check: an illegal transition must return 409
   `invalid_transition`.
5. **Reporter notification.** After `resolved`, `notification_outbox`
   must hold a `reporter_resolved` row addressed to the report's
   `reporter_contact`. Worker drain log shows the send attempt.
   Without `POSTMARK_TOKEN` the provider can't deliver — the
   outbox row + attempt log is the notification guarantee in dev.
6. **Error loop.** If the log monitor flags an error: open a GitHub
   issue, fix, re-run the failing step.

## Pass criteria

- Both severities stored with correct zone, SLA due, and outbox rows.
- Status transitions follow `TRANSITIONS`; reporter notified on closure.
- No unhandled `[unhandled]`/`failed` lines in logs that are not
  explained (provider creds absent is expected and documented).
