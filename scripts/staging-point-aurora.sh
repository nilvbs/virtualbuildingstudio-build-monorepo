#!/usr/bin/env bash
# Ops helper: point EC2 staging .env at Aurora URLs supplied via /tmp/bld-aurora-urls.env
# Never commit real connection strings. URLs come from AWS Secrets Manager at runtime.
set -euo pipefail
APP_DIR=/home/ubuntu/BLD/stage
cd "$APP_DIR"
URL_FILE=/tmp/bld-aurora-urls.env
# shellcheck disable=SC1090
source "$URL_FILE"
chmod 600 "$URL_FILE" || true

touch .env
chmod 600 .env

upsert() {
  local key="$1"
  local val="$2"
  local esc
  esc=$(printf '%s' "$val" | sed -e 's/[&\\]/\\&/g')
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${esc}|" .env
  else
    printf '\n%s=%s\n' "$key" "$val" >> .env
  fi
}

upsert DATABASE_URL "$DATABASE_URL"
upsert DIRECT_DATABASE_URL "$DIRECT_DATABASE_URL"
upsert WEB_APP_URL "https://staging.bld.online"
upsert CORS_ORIGINS "https://staging.bld.online"
upsert NODE_ENV "production"
upsert AUTH_DEV_MODE "false"

docker compose up -d --force-recreate --remove-orphans api
sleep 8
curl -sS --max-time 15 http://127.0.0.1:4000/health || true
echo
echo HOST=
grep '^DATABASE_URL=' .env | sed -E 's#.*@([^:/]+).*#\1#'
rm -f "$URL_FILE"
echo done
