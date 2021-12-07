#!/usr/bin/env bash
set -e

DIRNAME=$(dirname "$0")

NODE="$DIRNAME/node-v16.13.1-darwin-arm64/bin/node"
SNYK_CLI="$DIRNAME/dist/cli/index.js"

"$NODE" "$SNYK_CLI" "$@"
