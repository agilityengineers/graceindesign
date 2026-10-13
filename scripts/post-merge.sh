#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Reconcile dependencies without deleting node_modules under the live preview.
# npm ci removes the entire tree, causing the running Next server to fail
# during even source-only merges. npm install uses the existing lockfile and
# leaves unchanged dependencies in place.
npm install --no-audit --no-fund

# Apply development migrations and seed only an empty database.
npm run db:setup -- --if-empty

# Replit reconciles and restarts the existing workflow after this script.
