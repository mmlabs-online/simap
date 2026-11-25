#!/usr/bin/env bash
# SIM-034 (D60): an isolated Docker client config for jobs on the self-hosted macOS runner, so docker login and a
# pinned buildx never touch the host's ~/.docker (production deploys use it). bash 3.2 compatible, never needs root.
# Writes $RUNNER_TEMP/docker/config.json (no credsStore, credHelpers or auths; plugin dirs found from the host CLI)
# and exports DOCKER_CONFIG and DOCKER_HOST through $GITHUB_ENV.
set -euo pipefail

for v in RUNNER_TEMP GITHUB_ENV; do
  if [ -z "${!v:-}" ]; then echo "::error::$v is not set" >&2; exit 2; fi
done
dir="$RUNNER_TEMP/docker"
host="${DOCKER_HOST:-$(docker context inspect --format '{{.Endpoints.docker.Host}}')}"

dirs=""
while read -r p; do
  [ -n "$p" ] || continue
  case "$p" in *'"'*|*'\'*) echo "::error::refusing plugin path with a quote or backslash" >&2; exit 1 ;; esac
  d="$(dirname "$p")"
  case "$dirs" in *"\"$d\""*) ;; *) dirs="${dirs:+$dirs,}\"$d\"" ;; esac
done < <(docker info --format '{{range .ClientInfo.Plugins}}{{.Path}}{{"\n"}}{{end}}')

mkdir -p "$dir"
printf '{"cliPluginsExtraDirs":[%s]}\n' "$dirs" > "$dir/config.json"
DOCKER_CONFIG="$dir" DOCKER_HOST="$host" docker version >/dev/null
{
  echo "DOCKER_CONFIG=$dir"
  echo "DOCKER_HOST=$host"
} >> "$GITHUB_ENV"
echo "docker config: $dir (host $host)"
