#!/usr/bin/env bash
set -euo pipefail
image="${1:?Pass the image tag}"
revision="${2:?Pass the expected source revision}"
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
docker run --detach --name "$container" --publish 127.0.0.1::3211 "$image" >/dev/null
address="$(docker port "$container" 3211/tcp)"
health="$(curl --fail --silent --show-error --retry 20 --retry-delay 1 --retry-connrefused --retry-all-errors "http://$address/api/health")"
jq --exit-status --arg revision "$revision" '.ok == true and .revision == $revision' <<< "$health"
homepage="$(curl --fail --silent --show-error "http://$address/")"
rg --quiet 'Good pictures' <<< "$homepage"
echo "Production image serves its UI and reports revision $revision."
