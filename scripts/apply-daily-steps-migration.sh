#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set a reviewed direct database URL before running}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/migrations/20260919090000_daily_steps.sql"
