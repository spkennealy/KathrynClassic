#!/usr/bin/env bash
#
# Deploy Supabase migrations + edge functions to dev, prod, or both.
#
# Usage:
#   scripts/deploy-supabase.sh dev
#   scripts/deploy-supabase.sh prod
#   scripts/deploy-supabase.sh both
#   scripts/deploy-supabase.sh prod --functions-only   # skip DB migrations
#
# Project refs (override via env if they ever change):
#   DEV_PROJECT_REF   (default: zknpsrphbfdbzsjilzpg  — local app / kathryn-classic-dev)
#   PROD_PROJECT_REF  (default: wgdjjpimubqbplzrdqpg  — Vercel / www.kathrynclassic.com)
#
# DB migrations are pushed with `supabase db push --db-url`, so set the pooler
# connection strings (keep these OUT of git — e.g. in a sourced ~/.zshrc or a
# gitignored scripts/.deploy.env you `source` first):
#   DEV_DB_URL   PROD_DB_URL
# If a *_DB_URL is unset, that environment's migrations are skipped (functions
# still deploy).
#
set -euo pipefail

# Load DB URLs / ref overrides from a gitignored creds file if present.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
fi

DEV_PROJECT_REF="${DEV_PROJECT_REF:-zknpsrphbfdbzsjilzpg}"
PROD_PROJECT_REF="${PROD_PROJECT_REF:-wgdjjpimubqbplzrdqpg}"

FUNCTIONS=(send-bulk-email send-registration-confirmation report-error)

TARGET="${1:-}"
FLAG="${2:-}"

deploy_env() {
  local name="$1" ref="$2" db_url="$3"

  echo ""
  echo "=============================================="
  echo "▶  Deploying to ${name}  (${ref})"
  echo "=============================================="

  # Migrations are best-effort: a failure here (bad DB URL, history mismatch)
  # must NOT block the function deploys below, which are the usual reason to run
  # this. Report and continue.
  if [[ "$FLAG" == "--migrations-only" ]] || [[ "$FLAG" != "--functions-only" && -n "$db_url" ]]; then
    echo "   • Pushing database migrations…"
    if supabase db push --db-url "$db_url"; then
      echo "     ✓ migrations up to date"
    else
      echo "     ⚠  migration push failed — continuing to functions (see message above)"
    fi
  else
    [[ "$FLAG" == "--functions-only" ]] \
      && echo "   • Skipping migrations (--functions-only)" \
      || echo "   • Skipping migrations (set ${name^^}_DB_URL to enable)"
  fi

  if [[ "$FLAG" != "--migrations-only" ]]; then
    for fn in "${FUNCTIONS[@]}"; do
      echo "   • Deploying function: ${fn}"
      supabase functions deploy "$fn" --project-ref "$ref"
    done
  fi

  echo "✔  ${name} done"
}

case "$TARGET" in
  dev)
    deploy_env dev  "$DEV_PROJECT_REF"  "${DEV_DB_URL:-}"
    ;;
  prod)
    deploy_env prod "$PROD_PROJECT_REF" "${PROD_DB_URL:-}"
    ;;
  both)
    deploy_env dev  "$DEV_PROJECT_REF"  "${DEV_DB_URL:-}"
    deploy_env prod "$PROD_PROJECT_REF" "${PROD_DB_URL:-}"
    ;;
  *)
    echo "Usage: $0 {dev|prod|both} [--functions-only]" >&2
    exit 1
    ;;
esac

echo ""
echo "All deployments complete."
