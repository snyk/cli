#!/usr/bin/env bash
set -e

DIRNAME=$(dirname "$0")

NODE="$DIRNAME/node-v14.6.0-darwin-x64/bin/node"
SNYK_CLI="$DIRNAME/cli/cli/index.js"

"$NODE" "$SNYK_CLI" "$@"
