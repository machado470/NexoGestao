#!/usr/bin/env bash
# Uses only an isolated local Docker project and throwaway database/certificate.
set -euo pipefail
cd "$(dirname "$0")/.."
smoke_dir="$(mktemp -d "${TMPDIR:-/tmp}/nexo-compose-smoke-XXXXXX")"
export COMPOSE_PROJECT_NAME="$(basename "$smoke_dir" | tr '[:upper:]' '[:lower:]')"
export NEXO_ENV_FILE="$smoke_dir/compose.env"
compose=(docker --host=unix:///var/run/docker.sock compose --project-name "$COMPOSE_PROJECT_NAME" --env-file "$NEXO_ENV_FILE" -f docker-compose.prod.yml)
# Never inherit selectors that could redirect Docker to an external host.
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then "${compose[@]}" logs --no-color --tail=100 || true; fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null || true
  rm -rf "$smoke_dir"
  exit "$result"
}
trap cleanup EXIT
mkdir "$smoke_dir/tls"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,DNS:nexo.test,DNS:app.nexo.test,DNS:api.nexo.test' \
  -keyout "$smoke_dir/tls/privkey.pem" -out "$smoke_dir/tls/fullchain.pem" 2>/dev/null
cat > "$NEXO_ENV_FILE" <<ENV
POSTGRES_USER=nexo_smoke
POSTGRES_PASSWORD=disposable-smoke-password
POSTGRES_DB=nexo_smoke
DATABASE_URL=postgresql://nexo_smoke:disposable-smoke-password@postgres:5432/nexo_smoke?schema=public
REDIS_PASSWORD=disposable-redis-password
REDIS_URL=redis://:disposable-redis-password@redis:6379
JWT_SECRET=disposable-smoke-jwt-secret-at-least-32-characters
STRIPE_SECRET_KEY=sk_test_disposable
STRIPE_WEBHOOK_SECRET=whsec_disposable
STRIPE_PRICE_STARTER=price_disposable_starter
STRIPE_PRICE_PRO=price_disposable_pro
STRIPE_PRICE_BUSINESS=price_disposable_business
DOMAIN=nexo.test
TLS_CERT_DIR=$smoke_dir/tls
HTTP_PORT=0
HTTPS_PORT=0
VITE_API_URL=https://api.nexo.test
APP_URL=https://app.nexo.test
FRONTEND_URL=https://app.nexo.test
CORS_ORIGINS=https://app.nexo.test
WHATSAPP_PROVIDER=meta_cloud
ENV
chmod 600 "$NEXO_ENV_FILE"
# The optional session CA is mounted only during networked build steps.
if [ -n "${CODEX_PROXY_CERT:-}" ]; then
  cat > "$smoke_dir/build-ca.yml" <<CA
services:
  api:
    build:
      secrets: [proxy_ca]
  web:
    build:
      secrets: [proxy_ca]
  migrate:
    build:
      secrets: [proxy_ca]
secrets:
  proxy_ca:
    file: ${CODEX_PROXY_CERT}
CA
  compose+=(-f "$smoke_dir/build-ca.yml")
fi
"${compose[@]}" config --quiet
node --test scripts/wait-for-postgres.test.mjs
if [ "${1:-}" = '--config-only' ]; then exit 0; fi
"${compose[@]}" build api web migrate
"${compose[@]}" up -d --wait postgres redis
"${compose[@]}" run --rm migrate
"${compose[@]}" run --rm -e NEXO_DISPOSABLE_COMPOSE_SMOKE=1 migrate node scripts/check-operational-actions-index.test.mjs
"${compose[@]}" up -d --wait --wait-timeout 240 api web nginx
"${compose[@]}" exec -T nginx nginx -t
https_endpoint="$("${compose[@]}" port nginx 443)"
http_endpoint="$("${compose[@]}" port nginx 80)"
curl --fail --silent --show-error --cacert "$smoke_dir/tls/fullchain.pem" \
  -H 'Host: app.nexo.test' "https://localhost:${https_endpoint##*:}/" | grep -q '<div id="root">'
curl --fail --silent --show-error --cacert "$smoke_dir/tls/fullchain.pem" \
  -H 'Host: api.nexo.test' "https://localhost:${https_endpoint##*:}/v1/health" > "$smoke_dir/health.json"
node -e 'const h=JSON.parse(require("fs").readFileSync(process.argv[1])); if(h.success!==true || h.data?.status!=="ok") process.exit(1)' "$smoke_dir/health.json"
# Redirect must preserve Nginx variables after DOMAIN substitution.
curl --silent --show-error --dump-header "$smoke_dir/redirect" --output /dev/null \
  -H 'Host: app.nexo.test' "http://localhost:${http_endpoint##*:}/smoke?check=1"
grep -q 'Location: https://app.nexo.test/smoke?check=1' "$smoke_dir/redirect"
curl --fail --silent --show-error --cacert "$smoke_dir/tls/fullchain.pem" \
  -H 'Host: api.nexo.test' "https://localhost:${https_endpoint##*:}/v1/health/readiness" > "$smoke_dir/readiness.json"
node -e 'const h=JSON.parse(require("fs").readFileSync(process.argv[1])); if(h.success!==true || h.data?.status!=="ready") process.exit(1)' "$smoke_dir/readiness.json"
# A failed login to the pristine database proves BFF -> API connectivity.
login_status="$(curl --silent --show-error --cacert "$smoke_dir/tls/fullchain.pem" \
  -H 'Host: app.nexo.test' -H 'Content-Type: application/json' \
  --data '{"json":{"email":"nobody@example.test","password":"unused-password"}}' \
  --output "$smoke_dir/login.json" --write-out '%{http_code}' \
  "https://localhost:${https_endpoint##*:}/api/trpc/auth.login")"
test "$login_status" = 401
grep -q 'UNAUTHORIZED' "$smoke_dir/login.json"
"${compose[@]}" exec -T api node -e 'require("@nexogestao/common"); require("@sentry/profiling-node").nodeProfilingIntegration(); require("./dist/app.module"); if(typeof require("@prisma/client").PrismaClient!=="function") process.exit(1)'
echo 'Disposable production Compose smoke passed; no external deployment performed.'
