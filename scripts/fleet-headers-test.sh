#!/bin/sh
# The fleet image's cache rules, checked against the real server.
#
# Runs docker/fleet-nginx.conf in the same nginx image Dockerfile.fleet ships,
# over a two-file stand-in for the bundle, and asserts what a browser needs:
#
#   index.html (and any client route, which falls back to it): no-cache
#   /assets/*                : public, max-age=31536000, immutable -- once
#   a missing /assets/*      : 404, never index.html
#   config.json              : no-store
#
#     sh scripts/fleet-headers-test.sh
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
image=$(sed -n 's/^FROM \(nginxinc\/nginx-unprivileged:[^ ]*\).*/\1/p' "$root/Dockerfile.fleet")
[ -n "$image" ] || { echo "no nginx image in Dockerfile.fleet" >&2; exit 1; }

site=$(mktemp -d)
name="fleet-headers-test-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$site"; }
trap cleanup EXIT

mkdir "$site/assets"
echo '<!doctype html><title>fleet</title>' > "$site/index.html"
echo 'export default 1' > "$site/assets/index-AbCdEfGh.js"
echo '{}' > "$site/config.json"
chmod -R a+rX "$site"

docker run -d --name "$name" -p 127.0.0.1::8080 \
  -v "$root/docker/fleet-nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$site:/usr/share/nginx/html:ro" "$image" >/dev/null
port=$(docker port "$name" 8080/tcp | head -n1 | sed 's/.*://')

i=0
until curl -fs -o /dev/null "http://127.0.0.1:$port/"; do
  i=$((i + 1))
  [ "$i" -lt 50 ] || { echo "nginx did not come up" >&2; docker logs "$name" >&2; exit 1; }
  sleep 0.2
done

fail=0
# check PATH STATUS CACHE-CONTROL-LINES(newline separated; empty means none)
check() {
  path=$1 want_status=$2 want_cc=$3
  head=$(curl -s -D - -o /dev/null "http://127.0.0.1:$port$path" | tr -d '\r')
  status=$(printf '%s\n' "$head" | sed -n '1s/^HTTP[^ ]* \([0-9]*\).*/\1/p')
  cc=$(printf '%s\n' "$head" | sed -n 's/^[Cc]ache-[Cc]ontrol: //p')
  if [ "$status" = "$want_status" ] && [ "$cc" = "$want_cc" ]; then
    echo "ok   $path  $status  ${cc:-(no Cache-Control)}"
  else
    echo "FAIL $path  want $want_status '${want_cc}'  got $status '${cc}'" >&2
    fail=1
  fi
}

check /                                  200 'no-cache'
check /index.html                        200 'no-cache'
check /info                              200 'no-cache'
check /assets/index-AbCdEfGh.js          200 'public, max-age=31536000, immutable'
check /assets/gone-ZyXwVuTs.js           404 ''
check /config.json                       200 'no-store'

# A 404 must not be index.html.
body=$(curl -s "http://127.0.0.1:$port/assets/gone-ZyXwVuTs.js")
case $body in *'<title>fleet</title>'*) echo "FAIL a missing asset returned index.html" >&2; fail=1 ;; esac

exit $fail
