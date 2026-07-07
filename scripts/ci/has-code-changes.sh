#!/usr/bin/env bash
# Exit 0 if the full CI pipeline is required; exit 1 if light pipeline is enough.
# Fail-closed: unknown paths default to full (exit 0).
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PATHSPECS_FILE="${LIGHT_PIPELINE_PATHSPECS_FILE:-${CODE_CHANGE_PATHSPECS_FILE:-$SCRIPT_DIR/light-pipeline-pathspecs.txt}}"
BASE_REF="${BASE_REF:-origin/main}"

if [ ! -r "$PATHSPECS_FILE" ]; then
  echo "has-code-changes: missing pathspecs file: $PATHSPECS_FILE" >&2
  exit 2
fi

LIGHT_PATHSPECS=()
while IFS= read -r line; do
  LIGHT_PATHSPECS+=("$line")
done < <("$SCRIPT_DIR/load-pathspecs.sh" "$PATHSPECS_FILE")
if [ "${#LIGHT_PATHSPECS[@]}" -eq 0 ]; then
  echo "has-code-changes: no pathspecs in $PATHSPECS_FILE" >&2
  exit 2
fi

ALL_CHANGED="$("$SCRIPT_DIR/list-changed-files.sh" | grep -Ev '(^|/)node_modules/' || true)"
if [ -z "$ALL_CHANGED" ]; then
  exit 1
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF")"
LIGHT_CHANGED="$(git diff --name-only "${MERGE_BASE}...HEAD" -- "${LIGHT_PATHSPECS[@]}" || true)"
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    .circleci/*) ;;
    *.yml|*.yaml) LIGHT_CHANGED="${LIGHT_CHANGED}"$'\n'"${file}" ;;
  esac
done <<< "$ALL_CHANGED"

NON_LIGHT="$(comm -23 <(printf '%s\n' "$ALL_CHANGED" | sort) <(printf '%s\n' "$LIGHT_CHANGED" | sort -u))"
if [ -n "$NON_LIGHT" ]; then
  exit 0
fi
exit 1
