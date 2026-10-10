#!/usr/bin/env bash
# scripts/fix/email-golive.sh — one-off: deploy main and switch on Cloudflare
# email + the story_graph export on prod (#42, #46, #39, #43).
#
#   bash scripts/fix/email-golive.sh                         # dry run (default)
#   bash scripts/fix/email-golive.sh --apply --test-to you@example.com
#
# Options:
#   --apply              make changes (default is a read-only dry run)
#   --test-to ADDR       required with --apply: one direct test email goes here
#   --skip-deploy        skip deploy.sh (e.g. re-run after a later step failed)
#   --token-file PATH    local file holding CF_API_TOKEN=… (default below)
#   --export-report ID   report whose story_graph_export row is queued (default 11)
#
# Order matters (#42): deploy → purge test-recipient rows → upsert env →
# recreate api+worker → verify token → test sends. Every --apply step is
# idempotent, so re-running after a failure is safe.
#
# Secrets: the token is read locally into a variable and sent over ssh STDIN —
# never in argv, never echoed. The VM-side verify prints only the status.
# Audit JSON (no secrets) → data/audit/email-golive-<ts>.json.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APPLY=0; TEST_TO=""; SKIP_DEPLOY=0; EXPORT_ID=11
TOKEN_FILE="$HOME/projects/github/story_graph/.env"
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    --test-to) TEST_TO="${2:?--test-to needs an address}"; shift ;;
    --skip-deploy) SKIP_DEPLOY=1 ;;
    --token-file) TOKEN_FILE="${2:?}"; shift ;;
    --export-report) EXPORT_ID="${2:?}"; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
[[ "$EXPORT_ID" =~ ^[0-9]+$ ]] || { echo "--export-report must be numeric" >&2; exit 2; }
if [ "$APPLY" = 1 ] && [[ ! "$TEST_TO" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "--apply needs --test-to <address you own>" >&2; exit 2
fi

VM="ubuntu@192.9.226.218"
SSH=(ssh -i "$HOME/.ssh/id_ed25519" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o BatchMode=yes -o LogLevel=ERROR "$VM")
ENVF=/opt/leakdetector/leakdetector.env
CF_ACCOUNT_ID=062579a5337db8e60922bca1c0fd922f
CF_EMAIL_FROM=leaks@aikifield.com
STORY_GRAPH_INGEST_EMAIL=corpus@aikifield.com
SITE=https://peec.biz/LeakDetector
TS=$(date -u +%Y%m%dT%H%M%SZ)
AUDIT="data/audit/email-golive-$TS.json"
mkdir -p data/audit
declare -A A=([mode]=$([ "$APPLY" = 1 ] && echo apply || echo dry-run) [started]="$TS")

step() { echo; echo "== $* =="; }
die()  { echo "ERROR: $*" >&2; write_audit failed; exit 1; }
sql()  { "${SSH[@]}" "docker exec -i leakdetector-db psql -U postgres -d leakdetector -tA -v ON_ERROR_STOP=1"; }
write_audit() {
  A[result]="${1:-ok}"; A[finished]=$(date -u +%Y%m%dT%H%M%SZ)
  { echo "{"; local first=1
    for k in "${!A[@]}"; do
      [ $first = 1 ] || echo ","; first=0
      printf '  "%s": "%s"' "$k" "$(printf '%s' "${A[$k]}" | tr '\n' ';' | sed 's/"/\\"/g')"
    done; echo; echo "}"; } > "$AUDIT"
  echo "audit: $AUDIT"
}

# ---------------------------------------------------------------- preflight
step "preflight"
git fetch -q origin
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || die "not on main"
[ -z "$(git status --porcelain --untracked-files=no)" ] || die "working tree has uncommitted changes"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "local main != origin/main — pull/push first"
A[commit]=$(git rev-parse --short HEAD); echo "main @ ${A[commit]}"

[ -r "$TOKEN_FILE" ] || die "token file not readable: $TOKEN_FILE"
TOKEN=$(awk '/^CF_API_TOKEN=/{v=substr($0,index($0,"=")+1)} END{print v}' "$TOKEN_FILE" | tr -d '\r"'"'"' ')
[ -n "$TOKEN" ] || die "CF_API_TOKEN missing/empty in $TOKEN_FILE"
echo "local token: present (${#TOKEN} chars)"

"${SSH[@]}" true || die "cannot ssh to $VM"
echo "VM env keys of interest:"; "${SSH[@]}" "grep -oE '^(CF_[A-Z_]+|STORY_GRAPH_INGEST_EMAIL|SEED_ADMIN_PASSWORD)=' $ENVF | tr -d = | sed 's/^/  /' || true"

# ---------------------------------------------------------------- 1. deploy
step "1. deploy main"
if [ "$SKIP_DEPLOY" = 1 ]; then
  echo "skipped (--skip-deploy)"; A[deploy]=skipped
elif [ "$APPLY" = 0 ]; then
  bash scripts/deploy.sh dryrun | tail -20; A[deploy]=dryrun
else
  bash scripts/deploy.sh
  echo "waiting for remote-setup.sh on the VM (polls every 15 s, 25 min max)…"
  sleep 5
  for i in $(seq 1 100); do
    if "${SSH[@]}" "grep -q 'remote setup done' /opt/leakdetector/deploy.log"; then break; fi
    if ! "${SSH[@]}" "pgrep -f remote-setup.sh >/dev/null"; then
      "${SSH[@]}" "tail -30 /opt/leakdetector/deploy.log" >&2; die "remote-setup.sh exited without 'remote setup done'"
    fi
    [ "$i" = 100 ] && { "${SSH[@]}" "tail -30 /opt/leakdetector/deploy.log" >&2; die "remote-setup.sh timed out"; }
    sleep 15
  done
  echo "remote setup done"; A[deploy]="done"
fi

# ---------------------------------------------------------------- 2. purge
step "2. purge pending test-recipient rows (example.nz / example.govt.nz)"
echo "pending by recipient domain (before):"
BEFORE=$(echo "SELECT split_part(recipient,'@',2)||'='||count(*) FROM notification_outbox WHERE status='pending' GROUP BY split_part(recipient,'@',2) ORDER BY 1;" | sql)
echo "${BEFORE:-  (none)}" | sed 's/^/  /'; A[pending_before]="$BEFORE"
if [ "$APPLY" = 1 ]; then
  N=$(echo "WITH u AS (UPDATE notification_outbox SET status='failed', last_error='purged before email go-live: test recipient' WHERE status='pending' AND split_part(recipient,'@',2) IN ('example.nz','example.govt.nz') RETURNING 1) SELECT count(*) FROM u;" | sql)
  echo "purged: $N"; A[purged]=$N
  AFTER=$(echo "SELECT split_part(recipient,'@',2)||'='||count(*) FROM notification_outbox WHERE status='pending' GROUP BY split_part(recipient,'@',2) ORDER BY 1;" | sql)
  echo "pending (after): ${AFTER:-none}"; A[pending_after]="$AFTER"
fi

# ---------------------------------------------------------------- 3. env
step "3. upsert CF_ACCOUNT_ID, CF_API_TOKEN, CF_EMAIL_FROM, STORY_GRAPH_INGEST_EMAIL in $ENVF"
if [ "$APPLY" = 1 ]; then
  # Fixed remote program (no secrets in argv); KEY=VALUE lines arrive on stdin.
  # Replaces existing keys in place, appends missing ones, keeps perms (umask 077).
  REMOTE_UPSERT='set -euo pipefail; umask 077; f='"$ENVF"'; in=$(mktemp); out=$(mktemp)
    cat > "$in"
    awk -F= '"'"'NR==FNR{v[$1]=$0; o[++n]=$1; next} ($1 in v){print v[$1]; s[$1]=1; next} {print} END{for(i=1;i<=n;i++) if(!(o[i] in s)) print v[o[i]]}'"'"' "$in" "$f" > "$out"
    cat "$out" > "$f"; rm -f "$in" "$out"
    grep -oE "^(CF_[A-Z_]+|STORY_GRAPH_INGEST_EMAIL)=" "$f" | tr -d = | sed "s/^/  set: /"'
  printf 'CF_ACCOUNT_ID=%s\nCF_API_TOKEN=%s\nCF_EMAIL_FROM=%s\nSTORY_GRAPH_INGEST_EMAIL=%s\n' \
    "$CF_ACCOUNT_ID" "$TOKEN" "$CF_EMAIL_FROM" "$STORY_GRAPH_INGEST_EMAIL" | "${SSH[@]}" "bash -c $(printf %q "$REMOTE_UPSERT")"
  A[env]=upserted
else
  echo "would set CF_ACCOUNT_ID=$CF_ACCOUNT_ID, CF_API_TOKEN=<${#TOKEN} chars>, CF_EMAIL_FROM=$CF_EMAIL_FROM, STORY_GRAPH_INGEST_EMAIL=$STORY_GRAPH_INGEST_EMAIL"
fi
unset TOKEN

# ---------------------------------------------------------------- 4. recreate
step "4. recreate api + worker (docker restart would NOT re-read --env-file)"
if [ "$APPLY" = 1 ]; then
  # Keep in sync with the api/worker `docker run` lines in deploy/remote-setup.sh.
  "${SSH[@]}" 'set -e
    docker rm -f leakdetector-api leakdetector-worker >/dev/null 2>&1 || true
    docker run -d --name leakdetector-api --network leaknet --restart always -p 8002:8080 --env-file /opt/leakdetector/leakdetector.env -v leakdetector-uploads:/data/uploads leakdetector-api >/dev/null
    docker run -d --name leakdetector-worker --network leaknet --restart always --env-file /opt/leakdetector/leakdetector.env -v leakdetector-uploads:/data/uploads leakdetector-api node dist/src/worker.js >/dev/null
    for i in $(seq 1 20); do curl -sf http://127.0.0.1:8002/healthz >/dev/null && { echo "api healthy"; exit 0; }; sleep 2; done
    echo "api not healthy after 40 s" >&2; exit 1'
  A[recreate]="done"
else
  echo "would recreate leakdetector-api and leakdetector-worker"
fi

# ---------------------------------------------------------------- 5. verify token
step "5. verify token from the VM (IP-restricted to it)"
if [ "$APPLY" = 1 ]; then
  ST=$("${SSH[@]}" 'set -a; . /opt/leakdetector/leakdetector.env; set +a
    curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/tokens/verify" -H @<(printf "Authorization: Bearer %s" "$CF_API_TOKEN") | grep -oE "\"status\": *\"[a-z]+\"" | head -1 | tr -d " "')
  echo "token ${ST:-status unknown}"; A[token_status]="$ST"
  [ "$ST" = '"status":"active"' ] || die "token not active — check #39 (permission, IP filter)"
else
  echo "would call /accounts/$CF_ACCOUNT_ID/tokens/verify from the VM"
fi

# ---------------------------------------------------------------- 6. test sends
step "6. test sends: direct email to --test-to + story_graph_export for report $EXPORT_ID"
if [ "$APPLY" = 1 ]; then
  "${SSH[@]}" "docker exec -e TEST_TO='$TEST_TO' leakdetector-api node --input-type=module -e \"
    const { send } = await import('/app/dist/src/services/outbox.js');
    await send(process.env.TEST_TO, '[LeakDetector] email go-live test', 'Test from the LeakDetector worker via Cloudflare Email Sending (leaks@aikifield.com). No action needed.');
    console.log('direct test send: accepted by Cloudflare');\"" || die "direct test send failed"
  A[direct_test]="sent to $TEST_TO"
  # Same payload shape reports.ts builds (field by field, public fields only).
  echo "INSERT INTO notification_outbox (report_id, channel, recipient, template, payload, dedupe_key)
        SELECT r.id, 'email', '$STORY_GRAPH_INGEST_EMAIL', 'story_graph_export',
               jsonb_build_object('ref', 'WL-'||lpad(r.id::text, 6, '0'),
                 'tracking_url', '$SITE/r/'||r.id, 'api_url', '$SITE/api/v1/reports/'||r.id,
                 'category', r.category, 'severity', r.severity, 'zone', z.name, 'created_at', r.created_at),
               'story_graph:'||r.id
        FROM reports r JOIN council_zones z ON z.id = r.council_zone_id WHERE r.id = $EXPORT_ID
        ON CONFLICT (dedupe_key) DO NOTHING;" | sql >/dev/null
  echo "queued story_graph:$EXPORT_ID — waiting for the worker (30 s cycle)…"
  for i in $(seq 1 12); do
    S=$(echo "SELECT status||coalesce(' — '||last_error,'') FROM notification_outbox WHERE dedupe_key='story_graph:$EXPORT_ID';" | sql)
    [ "${S%% *}" = pending ] || break; sleep 10
  done
  echo "story_graph:$EXPORT_ID → $S"; A[story_graph_export]="$S"
else
  echo "would send one test email to --test-to and queue story_graph:$EXPORT_ID → $STORY_GRAPH_INGEST_EMAIL"
fi

# ---------------------------------------------------------------- summary
step "summary (public checks)"
H=$(curl -s -m 15 https://192-9-226-218.sslip.io/healthz || true); echo "healthz: $H"; A[healthz]="$H"
R=$(curl -s -m 15 "$SITE/r/$EXPORT_ID" | grep -c 'Status history' || true); echo "no-JS /r/$EXPORT_ID shows status history: $([ "$R" -gt 0 ] && echo yes || echo NO)"; A[nojs_page]=$R
O=$(curl -s -m 15 "$SITE/" | grep -o 'og:url" content="[^"]*"' || true); echo "og:url: $O"; A[og_url]="$O"
C=$(echo "SELECT status||'='||count(*) FROM notification_outbox GROUP BY status ORDER BY 1;" | sql | tr '\n' ' ')
echo "outbox by status: $C"; A[outbox]="$C"
write_audit ok
[ "$APPLY" = 1 ] || echo "dry run only — re-run with --apply --test-to <address>"
