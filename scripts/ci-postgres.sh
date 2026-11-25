#!/usr/bin/env bash
# SIM-034 (D60): throwaway Postgres for CI jobs on the self-hosted macOS runner (no `services:` there).
# usage: ci-postgres.sh sweep | start host | start network | stop     (bash 3.2 compatible, never needs root)
#   sweep          remove leftovers of earlier CI runs (everything labelled simap-ci=1)
#   start host     Postgres on a free 127.0.0.1 port; appends DATABASE_URL to $GITHUB_ENV (job `ci`)
#   start network  Postgres on a private --internal network, no published port; appends CHECK_IMAGE_NETWORK and
#                  CHECK_IMAGE_DATABASE_URL to $GITHUB_ENV (job `image`)
#   stop           remove this job's container and network (tolerates "not found")
# Only simap-ci-* resources labelled simap-ci=1 are ever touched: never the production Postgres, its ports or networks.
set -euo pipefail

for v in GITHUB_RUN_ID GITHUB_RUN_ATTEMPT GITHUB_JOB GITHUB_ENV; do
  if [ -z "${!v:-}" ]; then echo "::error::$v is not set" >&2; exit 2; fi
done
SUFFIX="$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$GITHUB_JOB"
PG="simap-ci-pg-$SUFFIX"
NET="simap-ci-net-$SUFFIX"

sweep() {
  local id
  docker ps -aq --filter label=simap-ci=1 | while read -r id; do
    [ -n "$id" ] && docker rm -f -v "$id" >/dev/null 2>&1 || true
  done
  docker network ls -q --filter label=simap-ci=1 | while read -r id; do
    [ -n "$id" ] && docker network rm "$id" >/dev/null 2>&1 || true
  done
  # Without -f: an image still used by a container is kept.
  docker image ls -q --filter reference='simap-ci' | while read -r id; do
    [ -n "$id" ] && docker image rm "$id" >/dev/null 2>&1 || true
  done
  echo "swept leftover simap-ci resources"
}

run_pg() { # <docker run args...>
  docker run -d --name "$PG" --label simap-ci=1 --label "simap-ci.run=$GITHUB_RUN_ID" \
    --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=postgres \
    --health-cmd "pg_isready -h 127.0.0.1 -U postgres" --health-interval 2s --health-retries 30 \
    "$@" postgres:17 >/dev/null
}

wait_healthy() {
  local i status=starting
  for i in $(seq 1 60); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$PG")"
    [ "$status" = healthy ] && return 0
    sleep 1
  done
  echo "::error::$PG is '$status' after 60 s" >&2
  docker logs "$PG" >&2 || true
  exit 1
}

start_host() {
  local n
  for n in DATABASE_URL PGHOST PGHOSTADDR PGPORT PGDATABASE PGUSER PGPASSWORD PGSERVICE SIMAP_DB_TARGET SIMAP_PROD_TUNNEL_PORT NODE_ENV; do
    if [ -n "${!n:-}" ]; then
      echo "::error::$n is set in the runner environment; remove it (CI must never reach another database)" >&2; exit 1
    fi
  done
  run_pg -p 127.0.0.1::5432
  local port
  port="$(docker port "$PG" 5432/tcp | head -n 1 | sed 's/.*://')"
  case "$port" in
    ""|*[!0-9]*|5432|15432) echo "::error::unexpected host port '$port'" >&2; exit 1 ;;
  esac
  wait_healthy
  echo "DATABASE_URL=postgres://postgres:postgres@127.0.0.1:$port/postgres" >> "$GITHUB_ENV"
  echo "started $PG on 127.0.0.1:$port"
}

start_network() {
  docker network create --internal --label simap-ci=1 "$NET" >/dev/null
  run_pg --network "$NET" --network-alias pg
  wait_healthy
  {
    echo "CHECK_IMAGE_NETWORK=$NET"
    echo "CHECK_IMAGE_DATABASE_URL=postgres://postgres:postgres@pg:5432/postgres"
  } >> "$GITHUB_ENV"
  echo "started $PG on network $NET"
}

stop() {
  if docker rm -f -v "$PG" >/dev/null 2>&1; then echo "removed $PG"; fi
  if docker network rm "$NET" >/dev/null 2>&1; then echo "removed $NET"; fi
}

case "${1:-}:${2:-}" in
  sweep:) sweep ;;
  start:host) start_host ;;
  start:network) start_network ;;
  stop:) stop ;;
  *) echo "usage: ci-postgres.sh sweep | start host | start network | stop" >&2; exit 2 ;;
esac
