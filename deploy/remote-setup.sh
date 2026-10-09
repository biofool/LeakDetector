#!/usr/bin/env bash
# remote-setup.sh — runs ON the backend VM (copied there by deploy.sh).
# Builds the image, creates secrets once, (re)starts db/api/worker.
set -e
cd /opt/leakdetector/backend

# Host firewall: OCI Ubuntu image REJECTs non-SSH inbound; docker published
# ports bypass INPUT, but host nginx on 80/443 does not. Re-assert on every
# deploy (not persistent across reboots — see docs/test-plan-e2e.md notes).
sudo -n iptables -C INPUT -p tcp --dport 80 -m state --state NEW -j ACCEPT 2>/dev/null || \
  sudo -n iptables -I INPUT 4 -p tcp --dport 80 -m state --state NEW -j ACCEPT
sudo -n iptables -C INPUT -p tcp --dport 443 -m state --state NEW -j ACCEPT 2>/dev/null || \
  sudo -n iptables -I INPUT 5 -p tcp --dport 443 -m state --state NEW -j ACCEPT

docker build -t leakdetector-api . >/dev/null

if [ ! -f /opt/leakdetector/leakdetector.env ]; then
  umask 077
  DB_PASS=$(openssl rand -hex 24); JWT=$(openssl rand -hex 32)
  cat > /opt/leakdetector/leakdetector.env <<ENV
DATABASE_URL=postgres://postgres:${DB_PASS}@leakdetector-db:5432/leakdetector
POSTGRES_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT}
PORT=8080
PUBLIC_BASE_URL=https://peec.biz/LeakDetector
API_PUBLIC_URL=https://peec.biz/LeakDetector
UPLOAD_DIR=/data/uploads
OUTBOX_INTERVAL_MS=30000
SLA_SWEEP_MS=300000
STORY_GRAPH_INGEST_EMAIL=corpus@aikifield.com
ENV
  echo "created /opt/leakdetector/leakdetector.env"
fi
set -a; . /opt/leakdetector/leakdetector.env; set +a

docker network inspect leaknet >/dev/null 2>&1 || docker network create leaknet
docker volume create leakdetector-pgdata >/dev/null
docker volume create leakdetector-uploads >/dev/null

docker rm -f leakdetector-db 2>/dev/null || true
docker run -d --name leakdetector-db --network leaknet --restart always \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" -e POSTGRES_DB=leakdetector \
  -v leakdetector-pgdata:/var/lib/postgresql/data \
  postgis/postgis:16-3.5 -c shared_buffers=64MB -c work_mem=4MB >/dev/null
ready=0
for i in $(seq 1 90); do
  docker exec leakdetector-db pg_isready -U postgres -d leakdetector -q && { ready=1; break; }
  sleep 2
done
[ "$ready" = 1 ] || { echo "leakdetector-db never became ready" >&2; exit 1; }

docker run --rm --network leaknet --env-file /opt/leakdetector/leakdetector.env \
  leakdetector-api node dist/src/migrate.js
docker run --rm --network leaknet --env-file /opt/leakdetector/leakdetector.env \
  leakdetector-api node dist/scripts/seed.js

docker rm -f leakdetector-api leakdetector-worker 2>/dev/null || true
docker run -d --name leakdetector-api --network leaknet --restart always \
  -p 8002:8080 --env-file /opt/leakdetector/leakdetector.env \
  -v leakdetector-uploads:/data/uploads leakdetector-api >/dev/null
docker run -d --name leakdetector-worker --network leaknet --restart always \
  --env-file /opt/leakdetector/leakdetector.env \
  -v leakdetector-uploads:/data/uploads \
  leakdetector-api node dist/src/worker.js >/dev/null

for i in $(seq 1 15); do
  curl -sf http://127.0.0.1:8002/healthz && break; sleep 2
done
echo "remote setup done"
