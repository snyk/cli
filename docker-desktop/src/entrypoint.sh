#!/usr/bin/env bash
set -euo pipefail

script_dir="$(dirname "$0")"
"${script_dir}/node-release/bin/node" "${script_dir}/bin/snyk" "$@"
