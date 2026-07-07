#!/usr/bin/env bash
# Print non-comment pathspec lines from a file (one per line).
set -euo pipefail

file="${1:?pathspec file required}"
if [ ! -r "$file" ]; then
  echo "load-pathspecs: missing pathspecs file: $file" >&2
  exit 2
fi

grep -v '^[[:space:]]*#' "$file" | grep -v '^[[:space:]]*$' || true
