#!/usr/bin/env bash
set -euo pipefail

show_port() {
  local port="$1"
  local label="$2"

  echo "[$label] porta $port"

  if command -v lsof >/dev/null 2>&1; then
    local out
    out="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$out" ]; then
      echo "$out"
      return
    fi
  fi

  if command -v ss >/dev/null 2>&1; then
    local ss_out
    ss_out="$(ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p {print}')"
    if [ -n "$ss_out" ]; then
      echo "$ss_out"
      return
    fi
  fi

  if command -v docker >/dev/null 2>&1; then
    docker ps --format '{{.Names}}\t{{.Ports}}' | awk -v p=":""$port" '$0 ~ p {print "docker:", $0}' || true
  fi

  echo "livre ou processo não identificado (faltam lsof/ss)."
}

show_port 3000 "API"
echo
show_port 3010 "WEB"
echo
show_port 5432 "Postgres"
echo
show_port 6379 "Redis"
