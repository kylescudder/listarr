#!/usr/bin/env bash
set -euo pipefail
image="${1:?Pass the image tag}"
revision="${2:?Pass the expected source revision}"
port="${3:-3211}"
container="listarr-smoke-${GITHUB_RUN_ID:-$$}"
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then docker logs "$container" || true; fi
  docker rm -f "$container" >/dev/null || true
  exit "$result"
}
trap cleanup EXIT
# No production credentials: this checks that the delivered image starts and
# serves its UI and health route without contacting TMDB, Clerk or Radarr.
docker run --detach --name "$container" --env PORT="$port" --publish "127.0.0.1::$port" "$image" >/dev/null
address="$(docker port "$container" "$port/tcp")"
health="$(curl --fail --silent --show-error --retry 20 --retry-delay 1 --retry-connrefused --retry-all-errors "http://$address/api/health")"
jq --exit-status --arg revision "$revision" '.ok == true and .revision == $revision' <<< "$health"
homepage="$(curl --fail --silent --show-error "http://$address/")"
[[ "$homepage" == *'Good pictures'* ]]
# Execute the image's actual healthcheck at the configured runtime port.
healthcheck="$(docker inspect --format '{{json .Config.Healthcheck.Test}}' "$container" | jq --exit-status --raw-output 'select(.[0] == "CMD-SHELL") | .[1]')"
docker exec "$container" sh -c "$healthcheck"
echo "Production image serves its UI, passes its healthcheck on port $port, and reports revision $revision."
