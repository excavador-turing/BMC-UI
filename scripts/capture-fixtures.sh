#!/bin/sh
# Capture the demo's data from a real board.
#
# The site's demo answers from these files. They are captured, not written:
# a fixture somebody invents drifts from what the board sends, and the whole
# claim of this site is that every number on it was measured on that board.
#
# Sanitising is not cosmetic. The board's MAC, addresses, hostname and serial
# identify one machine on one network, and the demo is public. Everything else
# -- temperatures, fan steps, uptimes, slot versions, NAND wear -- is real and
# stays real.
#
#   ./scripts/capture-fixtures.sh 192.168.77.20
#
# Run it from a host that can reach the board. It needs curl and ssh access,
# because /api/bmc wants credentials from anywhere but the board's own
# loopback -- which is why this runs the requests ON the board.
set -eu

# `--check` runs only the leak guard, against whatever is already committed.
# CI can do that with no board and no network, which is the point: the guard
# has to hold for the files in the repository, not just at capture time.
mode=capture
if [ "${1:-}" = "--check" ]; then
    mode=check
    shift
fi
if [ "$mode" = capture ]; then
    board="${1:?usage: capture-fixtures.sh [--check] <board-address>}"
fi

# What one board's identity is replaced with. RFC 5737 for the addresses,
# RFC 7042 for the MAC, an obviously-zero serial. Named here because the leak
# guard at the bottom has to know not to flag its own handiwork -- the first
# two versions of that guard failed on exactly that, which is the right way
# round for a guard to be wrong.
SAFE_IP=203.0.113.20
SAFE_GW=203.0.113.1
SAFE_MAC=00:00:5e:00:53:01
SAFE_HOST=turingpi
SAFE_SERIAL=XZCT000000000
out="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/src/demo/fixtures"
captured_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# What the interface reads. Anything absent here is a page the demo cannot draw.
# Every `type=` get.ts reads, not a hand-picked subset. Six of these had no
# fixture at all, so the demo drew those pages from nothing: firmware,
# firmware_sources, flash, health, network, update_check.
types="about other power node_info usb sdcard cooling thermal firmware_slots firmware_available firmware_sources firmware flash health hostname ntp info network update_check"

if [ "$mode" = capture ]; then
mkdir -p "$out"
printf 'capturing from %s\n' "$board"

for t in $types; do
    ssh "root@$board" \
        "curl -sk 'https://127.0.0.1/api/bmc?opt=get&type=$t'" \
        > "$out/$t.json.tmp"
    if [ ! -s "$out/$t.json.tmp" ]; then
        rm -f "$out/$t.json.tmp"
        printf '  %-20s EMPTY -- not captured\n' "$t"
        continue
    fi
    # One board's identity, replaced with a documentation-range equivalent.
    # RFC 5737 for the address, RFC 7042 for the MAC.
    # Either board, and then the whole management /24 -- a fixture is public
    # and the network it came from is not.
    sed -e "s/192\.168\.77\.20/$SAFE_IP/g" \
        -e "s/192\.168\.77\.30/$SAFE_IP/g" \
        -e "s/192\.168\.77\.1\b/$SAFE_GW/g" \
        -e "s/192\.168\.77\.\([0-9][0-9]*\)/203.0.113.\1/g" \
        -e "s/\([0-9a-f][0-9a-f]:\)\{5\}[0-9a-f][0-9a-f]/$SAFE_MAC/g" \
        -e "s/\"hive-bmc\"/\"$SAFE_HOST\"/g" \
        -e "s/\"board_serial\":\"[^\"]*\"/\"board_serial\":\"$SAFE_SERIAL\"/g" \
        "$out/$t.json.tmp" > "$out/$t.json"
    rm -f "$out/$t.json.tmp"
    printf '  %-20s %s bytes\n' "$t" "$(wc -c < "$out/$t.json")"
done

# The reader-task liveness the console page shows. POST, because that is the
# method bmcd exposes it under; it reads.
ssh "root@$board" "curl -sk -X POST 'https://127.0.0.1/api/bmc/serial/status'" > "$out/serial_status.json"
printf '  %-20s %s bytes\n' serial_status "$(wc -c < "$out/serial_status.json")"

# Each module's recent console output, so the demo can REPLAY a scrollback
# instead of pretending to stream. These are compute modules' kernel logs:
# they name cluster hosts and addresses, so the sanitiser is wider here --
# hive-N becomes node-N and the management /24 becomes documentation space.
for n in 0 1 2 3; do
    ssh "root@$board" "curl -sk 'https://127.0.0.1/api/bmc?opt=get&type=uart&node=$n'" \
      | sed -e "s/192\.168\.77\.\([0-9][0-9]*\)/203.0.113.\1/g" \
            -e "s/\([0-9a-f][0-9a-f]:\)\{5\}[0-9a-f][0-9a-f]/$SAFE_MAC/g" \
            -e "s/hive-\([0-9]\)/node-\1/g" \
            -e "s/\"hive-bmc\"/\"$SAFE_HOST\"/g" \
      > "$out/uart_$n.json"
    printf '  %-20s %s bytes\n' "uart node$n" "$(wc -c < "$out/uart_$n.json")"
done

ssh "root@$board" 'curl -s http://127.0.0.1:9110/metrics' > "$out/metrics.txt"
printf '  %-20s %s bytes\n' metrics "$(wc -c < "$out/metrics.txt")"

# The date is part of the data. A demo that cannot say when it was taken is
# indistinguishable from one that was invented.
cat > "$out/captured.json" <<EOF
{
  "captured_at": "$captured_at",
  "firmware": $(sed -n 's/.*"version":"\(v[^"]*\)".*/"\1"/p' "$out/about.json" | head -1),
  "note": "Captured from a Turing Pi 2 running this firmware. Addresses, MAC, hostname and serial are replaced with documentation-range values; every measurement is the board's own."
}
EOF
printf 'captured at %s\n' "$captured_at"
fi

# Anything the sanitiser missed is a leak, so fail loudly rather than commit it.
# The documentation MAC this script substitutes in is MAC-shaped and must not
# count against itself -- the first version of this guard failed on its own
# replacement, which is the right way round for a guard to be wrong.
leaks=$(grep -rhoE '192\.168\.[0-9]+\.[0-9]+|([0-9a-f][0-9a-f]:){5}[0-9a-f][0-9a-f]|hive-[a-z0-9-]*|XZCT[0-9][0-9]*' "$out" \
        | grep -vxF "$SAFE_MAC" \
        | grep -vxF "$SAFE_SERIAL" \
        | sort -u || true)
if [ -n "$leaks" ]; then
    printf 'ERROR: these look like one board and survived sanitising:\n%s\n' "$leaks" >&2
    grep -rlE "$(printf '%s' "$leaks" | head -1)" "$out" >&2 || true
    exit 1
fi
printf 'no board identifiers remain\n'
