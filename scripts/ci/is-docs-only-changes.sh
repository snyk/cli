#!/usr/bin/env bash
# Exit 0 if all changed files are docs assets (.md, .svg, .jpg); else exit 1.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PATHSPECS_FILE="${DOCS_ONLY_PATHSPECS_FILE:-$SCRIPT_DIR/docs-only-pathspecs.txt}"
BASE_REF="${BASE_REF:-origin/main}"

DOCS_PATHSPECS=()
while IFS= read -r line; do
  DOCS_PATHSPECS+=("$line")
done < <("$SCRIPT_DIR/load-pathspecs.sh" "$PATHSPECS_FILE")
if [ "${#DOCS_PATHSPECS[@]}" -eq 0 ]; then
  echo "is-docs-only-changes: no pathspecs in $PATHSPECS_FILE" >&2
  exit 2
fi

ALL_CHANGED="$("$SCRIPT_DIR/list-changed-files.sh" | grep -Ev '(^|/)node_modules/' || true)"
if [ -z "$ALL_CHANGED" ]; then
  exit 0
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF")"
DOCS_CHANGED="$(git diff --name-only "${MERGE_BASE}...HEAD" -- "${DOCS_PATHSPECS[@]}" || true)"
NON_DOCS="$(comm -23 <(printf '%s\n' "$ALL_CHANGED" | sort) <(printf '%s\n' "$DOCS_CHANGED" | sort -u))"
if [ -n "$NON_DOCS" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    echo "Error: disallowed file type for docs-only branch: $file" >&2
  done <<< "$NON_DOCS"
  exit 1
fi

exit 0
