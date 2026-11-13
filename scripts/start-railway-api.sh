#!/usr/bin/env sh
set -eu

# Nest uses API_PORT; Railway supplies PORT dynamically.
export API_PORT="${API_PORT:-${PORT:-3000}}"
exec sh /app/apps/api/docker-entrypoint.sh node dist/main.js
