#!/usr/bin/env bash
# e2e-backend-test.sh — drives docs/test-plan-e2e.md against a running API.
# Usage: BASE_URL=http://127.0.0.1:8080 bash scripts/e2e-backend-test.sh
set -euo pipefail

BASE="${BASE_URL:-http://127.0.0.1:8080}"
# PSQL_CMD overrides the DB probe for deployed environments, e.g.:
#   PSQL_CMD="ssh -i ~/.ssh/id_ed25519 ubuntu@192.9.226.218 docker exec leakdetector-db psql -U postgres -d leakdetector -tAc"
PSQL="${PSQL_CMD:-docker exec leakdetector-postgis psql -U postgres -d leakdetector -tAc}"
OUT="/tmp/leakdetector-e2e"; mkdir -p "$OUT"

pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; exit 1; }

# --- random NZ location + test photo ---------------------------------------
read -r LAT LNG <<<"$(python3 -c 'import random; print(f"{random.uniform(-47,-35):.5f} {random.uniform(167,178):.5f}")')"
PHOTO="$OUT/leak.png"
python3 - "$PHOTO" <<'PY'
import struct, zlib, sys
w = h = 8
raw = b"".join(b"\x00" + b"\xcc\x33\x33" * w for _ in range(h))
def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(raw))
       + chunk(b"IEND", b""))
open(sys.argv[1], "wb").write(png)
PY
echo "location: $LAT, $LNG"

# --- 1 report per severity --------------------------------------------------
declare -A IDS
for SEV in major minor; do
  MAIL="e2e-$SEV-$RANDOM@example.nz"
  curl -sf -X POST "$BASE/api/v1/reports" \
    -F "lat=$LAT" -F "lng=$LNG" -F "category=road" -F "severity=$SEV" \
    -F "description=e2e $SEV leak at $LAT,$LNG" \
    -F "reporter_name=E2E $SEV" -F "reporter_contact=$MAIL" \
    -F "photos=@$PHOTO;type=image/png" > "$OUT/create-$SEV.json" \
    || fail "POST /reports ($SEV) did not return 2xx"
  IDS[$SEV]=$(jq -r '.id' "$OUT/create-$SEV.json")
  echo "$MAIL" > "$OUT/mail-$SEV"
  pass "created $SEV report id=${IDS[$SEV]} ref=$(jq -r .ref "$OUT/create-$SEV.json")"
done

# --- recorded? API + DB ------------------------------------------------------
for SEV in major minor; do
  ID=${IDS[$SEV]}
  GOT=$(curl -sf "$BASE/api/v1/reports/$ID" | jq -r '.severity + "/" + .status')
  [ "$GOT" = "$SEV/received" ] || fail "GET /reports/$ID → $GOT (want $SEV/received)"
  DBROW=$($PSQL "SELECT severity||'/'||status FROM reports WHERE id=$ID")
  [ "$DBROW" = "$SEV/received" ] || fail "DB row $ID → $DBROW"
  pass "report $ID recorded (api=$GOT db=$DBROW)"
done

# --- staff login --------------------------------------------------------------
TOKEN=$(curl -sf -X POST "$BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"staff@example.govt.nz","password":"password123"}' | jq -r .token)
[ -n "$TOKEN" ] && [ "$TOKEN" != null ] || fail "staff login"
pass "staff login"

# staff list view must include nearby_open_count (issue #23 regression check)
NEARBY=$(curl -sf "$BASE/api/v1/reports" -H "Authorization: Bearer $TOKEN" | jq -r '.results[0] | has("nearby_open_count")')
[ "$NEARBY" = "true" ] || fail "staff list missing nearby_open_count"
pass "staff list includes nearby_open_count"

# --- workflow on the major report ---------------------------------------------
ID=${IDS[major]}
for S in investigating contractor_assigned resolved; do
  ST=$(curl -sf -X PATCH "$BASE/api/v1/reports/$ID" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"status\":\"$S\"}" | jq -r .status) || fail "PATCH → $S"
  [ "$ST" = "$S" ] || fail "status after PATCH = $ST (want $S)"
  pass "report $ID → $S"
done

# negative: illegal transition resolved → contractor_assigned must 409
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/v1/reports/$ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"contractor_assigned"}')
[ "$CODE" = 409 ] || fail "illegal transition returned $CODE (want 409)"
pass "illegal transition rejected (409)"

# --- reporter notified? --------------------------------------------------------
MAIL=$(cat "$OUT/mail-major")
sleep 2
ROW=$($PSQL "SELECT template||'→'||recipient||' ('||status||')' FROM notification_outbox WHERE report_id=$ID AND recipient='$MAIL' AND template='reporter_resolved'")
[ -n "$ROW" ] || fail "no reporter_resolved outbox row for $MAIL"
pass "reporter notification queued: $ROW"

echo "== all checks passed =="
