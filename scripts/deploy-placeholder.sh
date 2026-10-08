#!/usr/bin/env bash
# Publish the static "coming soon" page to https://peec.biz/LeakDetector/.
# peec.biz is cPanel shared hosting (no Node, no Postgres), so it only hosts
# this placeholder; the real app deploys to Railway (docs/spec.md, D-15).
#
# Usage: scripts/deploy-placeholder.sh [--dry-run]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${REPO_ROOT}/deploy/peec-placeholder/"
REMOTE="peecbiz@peec.biz:public_html/LeakDetector/"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/quantumaikido_ed25519}"

DRY_RUN=()
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=(--dry-run)
elif [[ $# -gt 0 ]]; then
    echo "ERROR: unknown argument: $1" >&2
    exit 2
fi

if [[ ! -f "${SRC}index.html" ]]; then
    echo "ERROR: ${SRC}index.html not found" >&2
    exit 1
fi
if [[ ! -r "$SSH_KEY" ]]; then
    echo "ERROR: SSH key not readable: $SSH_KEY (set SSH_KEY to override)" >&2
    exit 1
fi

rsync -av --delete "${DRY_RUN[@]}" --chmod=D755,F644 -e "ssh -i $SSH_KEY -o IdentitiesOnly=yes" "$SRC" "$REMOTE"

if [[ ${#DRY_RUN[@]} -eq 0 ]]; then
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 15 https://peec.biz/LeakDetector/ || true)"
    if [[ "$code" != "200" ]]; then
        echo "WARNING: https://peec.biz/LeakDetector/ returned HTTP $code after upload" >&2
        exit 1
    fi
    echo "OK: https://peec.biz/LeakDetector/ returns 200"
fi
