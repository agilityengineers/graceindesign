#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Install exactly the merged lockfile's dependencies.
npm ci --no-audit --no-fund

# Apply development migrations and seed only an empty database.
npm run db:setup -- --if-empty

# Replit reconciles and restarts the existing workflow after this script.
