#!/usr/bin/env bash
#
# Replace the DEV database's `public` schema with a copy of PROD's, so dev has
# real data to work against.
#
# Usage:
#   scripts/clone-prod-to-dev.sh --dry-run  # show both databases, change nothing
#   scripts/clone-prod-to-dev.sh            # prompts before touching anything
#   scripts/clone-prod-to-dev.sh --yes      # skip the prompt (for scripted use)
#
# What it copies:   the whole `public` schema — tables, data, views, functions,
#                   RLS policies and grants — plus the supabase_migrations history
#                   so `supabase db push` sees the same applied state in both.
# What it does NOT: `auth` (dev keeps its own logins) and `storage` (copying object
#                   metadata without the underlying files would leave dead links).
#
# Dev currently runs AHEAD of prod: the handicap-formula column and the net-score
# leaderboard view were applied to dev by hand and don't exist in prod yet. Copying
# prod over dev would drop them, so they are re-applied at the end — see
# DEV_AHEAD_MIGRATIONS below, and move a file out of that list once prod has it too.
#
# DEV IS WIPED. Its public schema is dropped and rebuilt from prod. A backup of
# dev's public schema is written to backups/ first, so a bad run is recoverable:
#   psql "$DEV_URL" -c 'drop schema public cascade' && psql "$DEV_URL" -f backups/<file>
#
# Connection strings come from scripts/.deploy.env (gitignored). Those are direct
# `db.<ref>.supabase.co` URLs, which only resolve over IPv6 — this script rewrites
# them to the IPv4 pooler host taken from SUPABASE_DB_URL in .env. Session mode
# (port 5432) is required: pg_dump does not work through transaction mode (6543).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DEV_REF="${DEV_PROJECT_REF:-zknpsrphbfdbzsjilzpg}"
PROD_REF="${PROD_PROJECT_REF:-wgdjjpimubqbplzrdqpg}"

[[ -f "$SCRIPT_DIR/.deploy.env" ]] || { echo "✗ scripts/.deploy.env not found"; exit 1; }
# shellcheck disable=SC1091
source "$SCRIPT_DIR/.deploy.env"
# shellcheck disable=SC1091
set -a; source "$ROOT_DIR/.env"; set +a

: "${DEV_DB_URL:?DEV_DB_URL not set in scripts/.deploy.env}"
: "${PROD_DB_URL:?PROD_DB_URL not set in scripts/.deploy.env}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL not set in .env (used for the pooler host)}"

POOL_HOST="$(sed -E 's#.*@([^:/]+):.*#\1#' <<<"$SUPABASE_DB_URL")"
pooler_url() { # $1 = direct db URL, $2 = project ref
  local pw
  pw="$(sed -E 's#postgresql://[^:]+:([^@]+)@.*#\1#' <<<"$1")"
  printf 'postgresql://postgres.%s:%s@%s:5432/postgres' "$2" "$pw" "$POOL_HOST"
}

PROD_URL="$(pooler_url "$PROD_DB_URL" "$PROD_REF")"   # read from, never written to
DEV_URL="$(pooler_url "$DEV_DB_URL" "$DEV_REF")"      # the only URL anything destructive touches

# --- Direction guards -------------------------------------------------------
# The pooler puts the project ref in the username, so the ref in each URL decides
# which project it reaches. Assert both directions rather than trusting the labels
# in .deploy.env, and refuse anything ambiguous.
[[ "$PROD_URL" == *"$PROD_REF"* ]] || { echo "✗ source URL does not target the prod ref ($PROD_REF)"; exit 1; }
[[ "$DEV_URL"  == *"$DEV_REF"*  ]] || { echo "✗ target URL does not target the dev ref ($DEV_REF)"; exit 1; }
[[ "$DEV_URL"  != *"$PROD_REF"* ]] || { echo "✗ refusing: the TARGET resolves to prod ($PROD_REF)"; exit 1; }
[[ "$PROD_URL" != *"$DEV_REF"*  ]] || { echo "✗ refusing: the SOURCE resolves to dev ($DEV_REF)"; exit 1; }
[[ "$PROD_URL" != "$DEV_URL"    ]] || { echo "✗ refusing: source and target are the same URL"; exit 1; }

# And confirm with the servers themselves that these are two different machines,
# so a copy-paste slip in .deploy.env can't make both halves the same database.
PROD_ADDR="$(psql "$PROD_URL" -Atc "select host(inet_server_addr())")"
DEV_ADDR="$(psql "$DEV_URL"  -Atc "select host(inet_server_addr())")"
[[ -n "$PROD_ADDR" && -n "$DEV_ADDR" && "$PROD_ADDR" != "$DEV_ADDR" ]] || {
  echo "✗ refusing: both URLs reach the same database server ($PROD_ADDR)"; exit 1; }

summarise() { # $1 = url, $2 = indent label
  psql "$1" -Atc "
    select '  contacts ' || (select count(*) from contacts)
        || ', registrations ' || (select count(*) from registrations)
        || ', golf_teams ' || (select count(*) from golf_teams)
        || ', admin logins ' || (select count(*) from auth.users)"
  psql "$1" -Atc "select '  newest registration: ' || coalesce(max(created_at)::date::text, 'none') from registrations"
  psql "$1" -Atc "select '  last admin action:   ' || coalesce(to_char(max(created_at), 'YYYY-MM-DD HH24:MI'), 'none') from audit_log" 2>/dev/null || true
}

echo "SOURCE — read only  (prod, $PROD_REF @ $PROD_ADDR)"
summarise "$PROD_URL"
echo ""
echo "TARGET — WILL BE WIPED  (dev, $DEV_REF @ $DEV_ADDR)"
summarise "$DEV_URL"
echo ""
echo "The source should be the busier database, showing the admin work you do on the"
echo "live site. If that description fits the TARGET instead, stop now."

if [[ "${1:-}" == "--dry-run" ]]; then
  echo ""
  echo "Dry run — nothing was changed."
  exit 0
fi

if [[ "${1:-}" != "--yes" ]]; then
  echo ""
  read -r -p "Replace dev ($DEV_REF) with prod ($PROD_REF)? Type 'yes' to continue: " reply
  [[ "$reply" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT_DIR/backups"
mkdir -p "$BACKUP_DIR"
DEV_BACKUP="$BACKUP_DIR/dev-public-$STAMP.sql"
PROD_DUMP="$BACKUP_DIR/prod-public-$STAMP.sql"

echo ""
echo "▶ Backing up dev's public schema → ${DEV_BACKUP#$ROOT_DIR/}"
pg_dump "$DEV_URL" --schema=public --no-owner > "$DEV_BACKUP"

echo "▶ Dumping prod's public schema → ${PROD_DUMP#$ROOT_DIR/}"
pg_dump "$PROD_URL" --schema=public --no-owner > "$PROD_DUMP"

# Two public tables hold a foreign key into auth.users (contact_filter_views.created_by,
# email_campaigns.sent_by). pg_dump adds those constraints AFTER loading the rows, so with
# prod's admin accounts absent from dev the restore would abort at the very end. Lift the
# statements out now and re-apply them once the orphaned values have been cleared.
AUTH_FKS="$BACKUP_DIR/auth-fks-$STAMP.sql"
# Each of these is a two-line statement: "ALTER TABLE ONLY x" then "ADD CONSTRAINT …".
# Buffer the ALTER line and only drop the pair when the constraint turns out to be the
# auth.users one — the same tables have other constraints that must survive.
awk -v kept="$AUTH_FKS" '
  /^ALTER TABLE ONLY / { pending = $0; next }
  /REFERENCES auth\.users/ {
    if (pending != "") { print pending > kept; print $0 > kept; pending = ""; next }
  }
  { if (pending != "") { print pending; pending = "" } print }
  END { if (pending != "") print pending }
' "$PROD_DUMP" > "$PROD_DUMP.tmp"
mv "$PROD_DUMP.tmp" "$PROD_DUMP"
touch "$AUTH_FKS"
echo "  held back $(grep -c 'ADD CONSTRAINT' "$AUTH_FKS" || true) foreign key(s) into auth.users"

# Supabase owns a set of default privileges under the `supabase_admin` role. The
# pooler connects as `postgres`, which may not alter another role's defaults, so
# these statements fail with "permission denied to change default privileges" —
# and since they sit at the very end of the dump, that abort would skip every
# step after the restore. They only affect privileges on FUTURE objects, and the
# equivalent `FOR ROLE postgres` defaults (which do apply) are kept, so dropping
# them costs nothing.
SKIPPED_ACLS="$(grep -c '^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin' "$PROD_DUMP" || true)"
grep -v '^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin' "$PROD_DUMP" > "$PROD_DUMP.tmp"
mv "$PROD_DUMP.tmp" "$PROD_DUMP"
echo "  skipped ${SKIPPED_ACLS:-0} supabase_admin default-privilege statement(s)"

echo "▶ Dropping dev's public schema"
psql "$DEV_URL" -v ON_ERROR_STOP=1 -q -c 'drop schema if exists public cascade;'

echo "▶ Restoring prod data into dev"
# The dump recreates the schema itself, along with its grants and policies.
psql "$DEV_URL" -v ON_ERROR_STOP=1 -q -f "$PROD_DUMP" > /dev/null

echo "▶ Detaching prod-only admin accounts, then restoring their foreign keys"
# Dev keeps its own logins, so rows created by a prod admin are detached rather than
# dragging prod's auth data across. Both columns are nullable, so only the attribution
# is lost. With the orphans cleared the held-back constraints can go back on.
psql "$DEV_URL" -v ON_ERROR_STOP=1 -q -c "
  update contact_filter_views set created_by = null
   where created_by is not null and created_by not in (select id from auth.users);
  update email_campaigns set sent_by = null
   where sent_by is not null and sent_by not in (select id from auth.users);
"
if [[ -s "$AUTH_FKS" ]]; then
  psql "$DEV_URL" -v ON_ERROR_STOP=1 -q -f "$AUTH_FKS"
fi

echo "▶ Re-applying migrations that dev has but prod doesn't"
# Dev is ahead of prod: these were applied to dev by hand, so they're absent from
# prod's schema and would be lost in the copy. They're written to be idempotent, so
# re-running them here is safe. Note this is deliberately NOT `supabase db push` —
# neither project records these in supabase_migrations, so a push would also re-run
# 20260711000000, whose upsert would overwrite the 2026 rules text with the version
# baked into that file, discarding any admin edits since.
DEV_AHEAD_MIGRATIONS=(
  "20260830000000_add_handicap_formula.sql"
  "20260830000001_leaderboard_net_scores.sql"
)
for migration in "${DEV_AHEAD_MIGRATIONS[@]}"; do
  path="$ROOT_DIR/supabase/migrations/$migration"
  if [[ -f "$path" ]]; then
    echo "   • $migration"
    psql "$DEV_URL" -v ON_ERROR_STOP=1 -q -f "$path" > /dev/null
  else
    echo "   ⚠  $migration not found — skipped"
  fi
done

echo "▶ Syncing migration history"
psql "$PROD_URL" -Atc "select version from supabase_migrations.schema_migrations order by version" \
  | while read -r version; do
      [[ -n "$version" ]] && psql "$DEV_URL" -q -c \
        "insert into supabase_migrations.schema_migrations (version) values ('$version') on conflict do nothing;"
    done

echo ""
echo "✓ Done. Dev now holds:"
psql "$DEV_URL" -Atc "select '  contacts ' || (select count(*) from contacts) || ', registrations ' || (select count(*) from registrations) || ', golf_teams ' || (select count(*) from golf_teams)"
echo ""
echo "  Dev backup kept at ${DEV_BACKUP#$ROOT_DIR/} (backups/ is gitignored)."
