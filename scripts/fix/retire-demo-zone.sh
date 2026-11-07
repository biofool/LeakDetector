#!/usr/bin/env bash
# scripts/fix/retire-demo-zone.sh — one-off: delete the seeded 'Demo City
# Council' / 'Citywide' zone, its test reports and demo staff on prod (#31).
#
#   bash scripts/fix/retire-demo-zone.sh            # dry run: survey only (default)
#   bash scripts/fix/retire-demo-zone.sh --apply    # delete, one transaction
#
# Options:
#   --apply              make changes (default is a read-only survey)
#   --max-reports N      refuse --apply if the demo zone holds more than N
#                        reports (default 20) — guards against real reports
#                        that fell into the demo bbox
#
# Delete order (FKs in backend/migrations): volunteers → reports (cascades to
# report_photos, report_status_history, notification_outbox; is_duplicate_of
# self-refs SET NULL) → NULL report_status_history.changed_by for demo users →
# demo users (platform_admin rows are kept, only detached) → zones → council.
# Deploys cannot recreate the rows: remote-setup.sh seeds with SEED_DEMO=0.
# Photo storage keys of deleted reports go to the audit for separate cleanup.
# Audit JSON → data/audit/retire-demo-zone-<ts>.json.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APPLY=0; MAX_REPORTS=20
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    --max-reports) MAX_REPORTS="${2:?--max-reports needs a number}"; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
[[ "$MAX_REPORTS" =~ ^[0-9]+$ ]] || { echo "--max-reports must be numeric" >&2; exit 2; }

VM="${LEAK_DB_HOST:-ubuntu@192.9.226.218}"
SSH=(ssh -i "${LEAK_SSH_KEY:-$HOME/.ssh/id_ed25519}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o BatchMode=yes -o LogLevel=ERROR "$VM")
TS=$(date -u +%Y%m%dT%H%M%SZ)
AUDIT="data/audit/retire-demo-zone-$TS.json"
mkdir -p data/audit
sql() { "${SSH[@]}" "docker exec -i leakdetector-db psql -U postgres -d leakdetector -tA -v ON_ERROR_STOP=1"; }

# Shared CTE prefix: the demo council, its zones, reports, users.
DEMO="WITH c AS (SELECT id FROM councils WHERE name = 'Demo City Council'),
  z AS (SELECT id FROM council_zones WHERE council_id IN (SELECT id FROM c)),
  r AS (SELECT id FROM reports WHERE council_zone_id IN (SELECT id FROM z)),
  u AS (SELECT id, role FROM users WHERE council_id IN (SELECT id FROM c))"

echo "== survey =="
SURVEY=$(echo "$DEMO SELECT json_build_object(
  'councils', (SELECT count(*) FROM c),
  'zones', (SELECT json_agg(json_build_object('id', id, 'name', name, 'alert_emails', alert_emails)) FROM council_zones WHERE id IN (SELECT id FROM z)),
  'reports', (SELECT count(*) FROM r),
  'report_ids', (SELECT json_agg(id ORDER BY id) FROM r),
  'volunteers', (SELECT count(*) FROM volunteers WHERE council_zone_id IN (SELECT id FROM z)),
  'outbox_rows', (SELECT count(*) FROM notification_outbox WHERE report_id IN (SELECT id FROM r)),
  'users', (SELECT json_agg(json_build_object('email', email, 'role', role)) FROM users WHERE id IN (SELECT id FROM u)),
  'cross_zone_duplicates', (SELECT count(*) FROM reports WHERE is_duplicate_of IN (SELECT id FROM r) AND id NOT IN (SELECT id FROM r)),
  'photo_keys', (SELECT json_agg(json_build_array(storage_key, thumb_key)) FROM report_photos WHERE report_id IN (SELECT id FROM r))
);" | sql)
echo "$SURVEY"
NC=$(echo "$SURVEY" | python3 -c 'import json,sys; print(json.load(sys.stdin)["councils"])')
NR=$(echo "$SURVEY" | python3 -c 'import json,sys; print(json.load(sys.stdin)["reports"])')

RESULT=dry-run
if [ "$APPLY" = 1 ]; then
  [ "$NC" = 1 ] || { echo "ERROR: expected exactly 1 'Demo City Council', found $NC — nothing deleted" >&2; RESULT="aborted: councils=$NC"; }
  if [ "$RESULT" = dry-run ] && [ "$NR" -gt "$MAX_REPORTS" ]; then
    echo "ERROR: demo zone holds $NR reports (> --max-reports $MAX_REPORTS) — review them; nothing deleted" >&2
    RESULT="aborted: reports=$NR"
  fi
  if [ "$RESULT" = dry-run ]; then
    echo "== apply =="
    sql <<SQL
BEGIN;
CREATE TEMP TABLE d_c ON COMMIT DROP AS SELECT id FROM councils WHERE name = 'Demo City Council';
CREATE TEMP TABLE d_z ON COMMIT DROP AS SELECT id FROM council_zones WHERE council_id IN (SELECT id FROM d_c);
CREATE TEMP TABLE d_u ON COMMIT DROP AS SELECT id FROM users WHERE council_id IN (SELECT id FROM d_c) AND role <> 'platform_admin';
DELETE FROM volunteers WHERE council_zone_id IN (SELECT id FROM d_z);
DELETE FROM reports WHERE council_zone_id IN (SELECT id FROM d_z);
UPDATE report_status_history SET changed_by = NULL WHERE changed_by IN (SELECT id FROM d_u);
DELETE FROM users WHERE id IN (SELECT id FROM d_u);
UPDATE users SET council_id = NULL WHERE council_id IN (SELECT id FROM d_c);
DELETE FROM council_zones WHERE id IN (SELECT id FROM d_z);
DELETE FROM councils WHERE id IN (SELECT id FROM d_c);
COMMIT;
SQL
    LEFT=$(echo "SELECT count(*) FROM councils WHERE name = 'Demo City Council';" | sql)
    [ "$LEFT" = 0 ] || { echo "ERROR: demo council still present after apply" >&2; RESULT="failed: council still present"; }
    [ "$RESULT" = dry-run ] && RESULT=applied
  fi
fi

python3 - "$AUDIT" "$TS" "$RESULT" "$SURVEY" <<'PY'
import json, sys
path, ts, result, survey = sys.argv[1:]
json.dump({"started": ts, "result": result, "survey": json.loads(survey)}, open(path, "w"), indent=2)
PY
echo "result: $RESULT"; echo "audit: $AUDIT"
case "$RESULT" in dry-run) echo "dry run only — re-run with --apply" ;; applied) ;; *) exit 1 ;; esac
