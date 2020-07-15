#!/usr/bin/env bash
set -e

NODE="./node-v8.9.4-darwin-x64/bin/node"
SNYK_CLI="./cli/cli/index.js"

"$NODE" "$SNYK_CLI" "$@"
