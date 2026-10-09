#!/usr/bin/env bash
# deploy.sh — deploy LeakDetector to peec.biz/LeakDetector
#
#   frontend  → static SPA at peecbiz@peec.biz:public_html/LeakDetector/
#   api/worker+PostGIS → docker on ubuntu@192.9.226.218 (airichardmoon-staging,
#                        interim host until shared-a1 gets A1 capacity)
#   /LeakDetector/api/* and /LeakDetector/uploads/* are proxied by
#   deploy/peecbiz/api-proxy.php → https://192-9-226-218.sslip.io
#
# Usage: bash scripts/deploy.sh          (full deploy)
#        bash scripts/deploy.sh dryrun   (build + show what would ship)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DRY=0; [ "${1:-}" = "dryrun" ] && DRY=1

PEEC_KEY="$HOME/.ssh/quantumaikido_ed25519"
VM_KEY="$HOME/.ssh/id_ed25519"
PEEC="peecbiz@peec.biz"
PEEC_DIR="public_html/LeakDetector/"
VM="ubuntu@192.9.226.218"

SSHX="-o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o LogLevel=ERROR"

echo "== preflight: dependency audit =="
bash scripts/audit-deps.sh

echo "== build frontend (base=/LeakDetector/) =="
(cd frontend && VITE_API_BASE_URL=/LeakDetector npx vite build --base=/LeakDetector/)

DIST=$(mktemp -d)
cp -r frontend/dist/* "$DIST/"
cp deploy/peecbiz/htaccess "$DIST/.htaccess"
cp deploy/peecbiz/api-proxy.php "$DIST/"
cp deploy/peecbiz/report.php "$DIST/"

if [ "$DRY" = 1 ]; then
  echo "== dryrun =="
  echo "would rsync $DIST/ -> $PEEC:$PEEC_DIR"
  rsync -avzn --delete -e "ssh -i $PEEC_KEY $SSHX" "$DIST/" "$PEEC:$PEEC_DIR" | tail -15
  echo "would rsync backend/ -> $VM:/opt/leakdetector/backend/ and restart containers"
  rm -rf "$DIST"; exit 0
fi

echo "== push frontend to peec.biz =="
ssh -i "$PEEC_KEY" $SSHX "$PEEC" "mkdir -p $PEEC_DIR"
rsync -avz --delete --chmod=D755,F644 -e "ssh -i $PEEC_KEY $SSHX" "$DIST/" "$PEEC:$PEEC_DIR"
rm -rf "$DIST"

echo "== push backend to $VM =="
ssh -i "$VM_KEY" $SSHX "$VM" "sudo -n mkdir -p /opt/leakdetector/backend && sudo -n chown -R \$USER:\$USER /opt/leakdetector"
rsync -az --delete --exclude node_modules --exclude dist --exclude data \
  -e "ssh -i $VM_KEY $SSHX" backend/ "$VM:/opt/leakdetector/backend/"
scp -i "$VM_KEY" $SSHX deploy/remote-setup.sh "$VM:/opt/leakdetector/remote-setup.sh"

echo "== build + (re)start containers on $VM =="
# Detached: the 1-OCPU box can drop ssh during npm ci / tsc; the log persists.
ssh -i "$VM_KEY" $SSHX "$VM" \
  'setsid nohup bash /opt/leakdetector/remote-setup.sh > /opt/leakdetector/deploy.log 2>&1 < /dev/null & echo "remote pid $!"'
echo "remote build running — tail /opt/leakdetector/deploy.log on the VM"
echo "  ssh -i $VM_KEY $VM tail -f /opt/leakdetector/deploy.log"
echo "then verify:"
echo "  curl -sf https://192-9-226-218.sslip.io/healthz"
curl -sf https://peec.biz/LeakDetector/api/reports -o /dev/null && echo "api via proxy: ok"
curl -sf https://peec.biz/LeakDetector/ -o /dev/null && echo "spa: ok"
echo "deploy done"
