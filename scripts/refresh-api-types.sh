#!/bin/sh
# Regenerate src/lib/api/schema.d.ts from a bmcd release's own OpenAPI document.
#
# The generator is run with `npx` at a pinned version rather than kept as a
# devDependency, and that is deliberate. `openapi-typescript` peers on
# `typescript@^5.x`; this repository is on TypeScript 6, which is the estate's
# standard. Adding it to the dependency graph would mean either downgrading
# TypeScript for the whole project or installing with --legacy-peer-deps and
# hoping. It emits a .d.ts and never compiles anything here, so its peer range
# is not this project's problem -- and the output does compile under TS 6,
# which is what actually matters and is checked by `npm run build`.
#
# The version it reads is in bmcd-release.txt, and must be the release the
# firmware pins. Keeping those two in step is part of every firmware pin bump.
set -eu

GENERATOR=openapi-typescript@7.13.0
OUT=src/lib/api/schema.d.ts
SPEC=$(mktemp)
trap 'rm -f "$SPEC"' EXIT INT TERM

version=$(tr -d ' \n' < bmcd-release.txt)
[ -n "$version" ] || { echo "bmcd-release.txt is empty" >&2; exit 1; }

echo "fetching the API document from bmcd $version"
gh release download "$version" --repo excavador-turing/bmcd \
    --pattern openapi.json --output "$SPEC" --clobber

# A document that describes nothing would generate types that admit anything,
# and it would do it quietly.
paths=$(grep -o '"/api/bmc' "$SPEC" | wc -l)
[ "$paths" -ge 20 ] || { echo "the document names only $paths paths; refusing" >&2; exit 1; }

npx --yes "$GENERATOR" "$SPEC" -o "$OUT"

# Formatted with the project's own prettier, so the committed file is
# lint-clean and, more importantly, so the CI drift check compares formatted
# output against formatted output rather than reporting whitespace as an API
# change.
npx prettier --write --log-level warn "$OUT"

echo "wrote $OUT from bmcd $version"
