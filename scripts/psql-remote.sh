#!/usr/bin/env bash
# psql-remote.sh "SQL" — run psql inside the leakdetector-db container on the
# deploy VM. Used by scripts/e2e-backend-test.sh via PSQL_CMD.
set -euo pipefail
HOST="${LEAK_DB_HOST:-ubuntu@192.9.226.218}"
KEY="${LEAK_SSH_KEY:-$HOME/.ssh/id_ed25519}"
printf -v q '%q' "$*"
exec ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o BatchMode=yes -o LogLevel=ERROR "$HOST" "docker exec leakdetector-db psql -U postgres -d leakdetector -tAc $q"
