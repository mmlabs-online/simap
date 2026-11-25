#!/usr/bin/env bash
# SIM-004: image checks shared by ci.yml and release.yml (Next.js standalone image, D1/D8).
# usage: check-image.sh <image-ref>   (run from the repo root: it compares db/migrations with the image)
#   CHECK_IMAGE_DATABASE_URL (env, CI only; release.yml never sets it): a throwaway Postgres URL reachable from
#   the Docker network named by CHECK_IMAGE_NETWORK. Enables the "db smoke" section (the app never migrates;
#   migrate from inside the image).
#   CHECK_IMAGE_NETWORK (env, default host): the network the db smoke containers join. The URL must be reachable
#   from it. On macOS `host` is the Docker VM, so ci.yml passes a private network (SIM-034, D60).
set -uo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: check-image.sh <image-ref>" >&2
  exit 2
fi
IMAGE="$1"
NAME="simap-smoke-$$"
DBNAME="simap-dbsmoke-$$"
EXITNAME="simap-exit-$$"
NET="${CHECK_IMAGE_NETWORK:-host}"
trap 'docker rm -f "$NAME" "$DBNAME" "$EXITNAME" >/dev/null 2>&1' EXIT
# Not secret; keeps the smoke valid once SIM-005 reads it. The JWKS is never fetched (no network).
ID=(-e MM_IDENTITY_ISSUER=https://api.mmlabs.online)

echo "== no secrets in image"
if docker image inspect "$IMAGE" --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | cut -d= -f1 | grep -Ei 'KEY|SECRET|TOKEN|PASSWORD'; then
  echo "::error::secret-like env name in image"; exit 1
fi
user="$(docker image inspect "$IMAGE" --format '{{.Config.User}}')"
case "$user" in ""|0|root|0:*|root:*) echo "::error::image runs as root (user '$user')"; exit 1 ;; esac
found=$(docker run --rm --user 0 --entrypoint sh "$IMAGE" -c "find / -xdev -name '.env*' -not -path '/proc/*' 2>/dev/null; true")
if [ -n "$found" ]; then echo "::error::.env files in image: $found"; exit 1; fi
maps=$(docker run --rm --entrypoint sh "$IMAGE" -c "find /app/.next/static -name '*.map'")
if [ -n "$maps" ]; then echo "::error::source maps in image: $maps"; exit 1; fi

echo "== image config"
cmd=$(docker image inspect "$IMAGE" --format '{{json .Config.Cmd}}')
if [ "$cmd" != '["node","server.js"]' ]; then
  echo "::error::image Cmd is $cmd, expected [\"node\",\"server.js\"]"; exit 1
fi
envs=$(docker image inspect "$IMAGE" --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E '^(NODE_ENV|HOSTNAME|PORT|DATABASE_URL|MM_IDENTITY_|SIMAP_|NEXT_)' | sort || true)
want=$(printf 'HOSTNAME=0.0.0.0\nNODE_ENV=production\nPORT=3000')
if [ "$envs" != "$want" ]; then
  echo "::error::image env must set exactly NODE_ENV, HOSTNAME and PORT among app variables, got: $envs"; exit 1
fi
hist=$(docker history --no-trunc "$IMAGE")
if printf '%s' "$hist" | grep -q 'NEXT_TELEMETRY.*ENV\|ENV.*NEXT_TELEMETRY\|DATABASE_URL'; then
  echo "::error::NEXT_TELEMETRY ENV or DATABASE_URL in image history"; exit 1
fi
if ! docker image inspect "$IMAGE" --format '{{json .Config.ExposedPorts}}' | grep -q '"3000/tcp"'; then
  echo "::error::image does not expose 3000/tcp"; exit 1
fi

echo "== layout"
if ! docker run --rm --entrypoint sh "$IMAGE" -c '
  set -e
  test -f /app/server.js
  grep -q "\"type\": *\"module\"" /app/package.json
  test -n "$(ls -A /app/.next/static)"
  test -d /app/public
  test -f /app/db/migrate.js && test -f /app/db/migrator.js
  test ! -e /app/src
  test -z "$(find /app -name "*.test.*" -not -path "*/node_modules/*")"
'; then
  echo "::error::image layout is wrong (server.js, type=module, .next/static, public, db/migrate.js, no src or tests)"; exit 1
fi
in_image=$(docker run --rm --entrypoint sh "$IMAGE" -c 'cd /app/db/migrations && ls *.sql 2>/dev/null; true' | sort)
in_repo=$(cd db/migrations && ls *.sql 2>/dev/null | sort)
if [ "$in_image" != "$in_repo" ]; then
  echo "::error::migrations in the image differ from db/migrations: image=[$in_image] repo=[$in_repo]"; exit 1
fi
# pg must resolve the way db/migrate.js sees it (consult risk 1: traced standalone node_modules).
if ! docker run --rm --entrypoint sh "$IMAGE" -c "cd /app/db && node --input-type=module -e \"await import('pg')\""; then
  echo "::error::pg does not resolve from /app/db (switch the Dockerfile to the migrate-deps option)"; exit 1
fi

echo "== start checks"
# No network and a 30 s cap: must exit 2 straight away.
expect_exit() { # <expected> <description> <docker run args...>
  local want="$1" what="$2"; shift 2
  # Portable 30 s cap (macOS has no GNU timeout): detached run, poll, 124 if still running (as GNU timeout).
  docker run -d --label simap-ci=1 --name "$EXITNAME" --network none "$@" >/dev/null 2>&1
  local got=124 i
  for i in $(seq 1 30); do
    if [ "$(docker inspect -f '{{.State.Running}}' "$EXITNAME" 2>/dev/null)" != true ]; then
      got=$(docker inspect -f '{{.State.ExitCode}}' "$EXITNAME" 2>/dev/null || echo 125)
      break
    fi
    sleep 1
  done
  docker rm -f "$EXITNAME" >/dev/null 2>&1
  if [ "$got" -ne "$want" ]; then echo "::error::$what: exit $got, expected $want"; exit 1; fi
}
expect_exit 2 "migrate without DATABASE_URL" "$IMAGE" node db/migrate.js

# probe <container> <path>: prints the HTTP status, then the body, fetched from inside the container.
probe() {
  docker exec "$1" node -e 'fetch("http://127.0.0.1:3000"+process.argv[1]).then(async r=>{console.log(r.status);process.stdout.write(await r.text())},()=>{console.log("000")})' "$2" 2>/dev/null
}
status() { probe "$1" "$2" | head -n 1; }

echo "== smoke"
# Same hardening as the deployment compose file; no DB and no network here, so /api/readyz must be 503.
docker run -d --label simap-ci=1 --name "$NAME" --cap-drop ALL --security-opt no-new-privileges --network none \
  "${ID[@]}" "$IMAGE" >/dev/null

ok=0
for _ in $(seq 1 30); do
  if [ "$(status "$NAME" /api/healthz)" = 200 ]; then ok=1; break; fi
  sleep 1
done
docker logs "$NAME"
if [ "$ok" -ne 1 ]; then echo "::error::smoke failed: /api/healthz did not return 200"; exit 1; fi
got=$(status "$NAME" /api/readyz)
if [ "$got" != 503 ]; then echo "::error::smoke failed: /api/readyz without a database is $got, expected 503"; exit 1; fi
page=$(probe "$NAME" /)
if [ "$(printf '%s' "$page" | head -n 1)" != 200 ]; then
  echo "::error::smoke failed: / is not 200"; exit 1
fi
asset=$(printf '%s' "$page" | grep -Eo '/_next/static/[^"]+\.(js|css)' | head -n 1)
if [ -z "$asset" ]; then echo "::error::smoke failed: no /_next/static asset referenced by /"; exit 1; fi
got=$(status "$NAME" "$asset")
if [ "$got" != 200 ]; then echo "::error::smoke failed: $asset is $got, expected 200"; exit 1; fi
got=$(status "$NAME" /_next/static/does-not-exist.js)
if [ "$got" != 404 ]; then echo "::error::smoke failed: a missing static file is $got, expected 404"; exit 1; fi
docker exec -i -e CHECK_HEADERS_URL=http://127.0.0.1:3000 "$NAME" node --input-type=module - < scripts/check-headers.mjs \
  || { echo "::error::security headers check failed"; exit 1; }
health=starting
for _ in $(seq 1 30); do
  health=$(docker inspect -f '{{.State.Health.Status}}' "$NAME")
  [ "$health" = healthy ] && break
  sleep 1
done
if [ "$health" != healthy ]; then echo "::error::image HEALTHCHECK is '$health', expected healthy"; exit 1; fi

if [ -n "${CHECK_IMAGE_DATABASE_URL:-}" ]; then
  echo "== db smoke"
  # The URL is never printed.
  # q <sql>: first column of the first row, run with the image's own pg.
  q() {
    docker run --rm --network "$NET" -w /app -e DATABASE_URL="$CHECK_IMAGE_DATABASE_URL" "$IMAGE" node --input-type=module -e '
      import pg from "pg";
      const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
      c.connect().then(() => c.query(process.argv[1])).then((r) => { console.log(r.rows[0] ? Object.values(r.rows[0])[0] : ""); return c.end(); })
        .catch(() => { console.error("query failed"); process.exit(1); });
    ' "$1"
  }
  fresh=$(q "select to_regclass('schema_migrations') is null") || { echo "::error::db smoke: cannot reach the database"; exit 1; }
  # The app first, on the not yet migrated database: it must be ready and must not create anything.
  docker run -d --label simap-ci=1 --name "$DBNAME" --network "$NET" -e DATABASE_URL="$CHECK_IMAGE_DATABASE_URL" \
    -e PORT=3000 "${ID[@]}" "$IMAGE" >/dev/null
  ok=0
  for _ in $(seq 1 30); do
    if [ "$(status "$DBNAME" /api/readyz)" = 200 ]; then ok=1; break; fi
    sleep 1
  done
  docker logs "$DBNAME" 2>&1 | grep -v DATABASE_URL
  if [ "$ok" -ne 1 ]; then echo "::error::db smoke: /api/readyz did not return 200"; exit 1; fi
  if [ "$fresh" = true ]; then
    if [ "$(q "select to_regclass('schema_migrations') is null")" != true ]; then
      echo "::error::db smoke: the app created schema_migrations (the app must never migrate)"; exit 1
    fi
  else
    echo "::notice::db smoke: database was already migrated, skipping the app-never-migrates assertion"
  fi
  if ! docker run --rm --network "$NET" -e DATABASE_URL="$CHECK_IMAGE_DATABASE_URL" "$IMAGE" node db/migrate.js; then
    echo "::error::db smoke: migrate failed inside the image"; exit 1
  fi
  want_rows=$(printf '%s\n' "$in_repo" | grep -c . || true)
  got_rows=$(q "select count(*) from schema_migrations")
  if [ "$got_rows" != "$want_rows" ]; then
    echo "::error::db smoke: schema_migrations has $got_rows rows, expected $want_rows"; exit 1
  fi
  again=$(docker run --rm --network "$NET" -e DATABASE_URL="$CHECK_IMAGE_DATABASE_URL" "$IMAGE" node db/migrate.js 2>&1)
  if ! printf '%s' "$again" | grep -q 'up to date'; then
    echo "::error::db smoke: second migrate run did not report 'up to date'"; exit 1
  fi
fi
echo "image ok"
