#!/usr/bin/env bash
set -e

DIRNAME=$(dirname "$0")

NODE="$DIRNAME/node-v12.18.3-darwin-x64/bin/node"
SNYK_CLI="$DIRNAME/dist/cli/index.js"

"$NODE" "$SNYK_CLI" "$@"
