#!/usr/bin/env bash
set -uo pipefail

echo "GOOS: ${GOOS}"
echo "GOARCH: ${GOARCH}"

cat ./bundled_extensions.json
