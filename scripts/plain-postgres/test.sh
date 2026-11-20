#!/usr/bin/env bash
# Run the database tests on plain Postgres (with pgTAP installed), no Docker needed.
# Usage: DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/plain-postgres/test.sh
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to an admin connection string}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="towelapp_test_$$"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qc "create database $DB"
trap 'psql "$DATABASE_URL" -qc "drop database if exists $DB" >/dev/null' EXIT

TEST_URL="${DATABASE_URL%/*}/$DB"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/plain-postgres/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

status=0
for t in "$ROOT"/supabase/tests/database/*.sql; do
  echo "== $(basename "$t")"
  out="$(psql "$TEST_URL" -v ON_ERROR_STOP=1 -qAt -f "$t" 2>&1)" || status=1
  echo "$out"
  grep -qE '^not ok|Looks like' <<<"$out" && status=1
done
exit $status
