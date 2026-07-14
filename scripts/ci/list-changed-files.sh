#!/usr/bin/env bash
# List files changed on HEAD since merge-base with a base ref (default origin/main).
set -euo pipefail

BASE_REF="${1:-${BASE_REF:-origin/main}}"

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "list-changed-files: unknown base ref: $BASE_REF" >&2
  exit 2
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF")"
git diff --name-only "${MERGE_BASE}...HEAD"
