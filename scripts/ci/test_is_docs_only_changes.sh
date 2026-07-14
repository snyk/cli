#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
IS_DOCS="$SCRIPT_DIR/is-docs-only-changes.sh"

with_repo() {
  local dir
  dir=$(mktemp -d)
  trap 'rm -rf "$dir"' RETURN

  cp "$SCRIPT_DIR/is-docs-only-changes.sh" \
    "$SCRIPT_DIR/list-changed-files.sh" \
    "$SCRIPT_DIR/load-pathspecs.sh" \
    "$dir/"
  chmod +x "$dir"/*.sh

  cd "$dir"
  git init -q
  git config user.email 'ci-test@example.com'
  git config user.name 'ci-test'
  echo base >README.md
  git add . && git commit -qm base

  export DOCS_ONLY_PATHSPECS_FILE="$SCRIPT_DIR/docs-only-pathspecs.txt"
  "$@"
}

commit_paths() {
  for f in "$@"; do
    mkdir -p "$(dirname -- "$f")"
    touch "$f"
    git add -- "$f"
  done
  git commit -qm "add: $*"
}

assert_docs() {
  commit_paths "$@"
  if ! BASE_REF=HEAD~1 "$IS_DOCS"; then
    echo "FAIL: expected docs-only for: $*" >&2
    exit 1
  fi
  echo "ok (docs): $*"
  git reset --hard HEAD~1 >/dev/null
}

assert_not_docs() {
  commit_paths "$@"
  if BASE_REF=HEAD~1 "$IS_DOCS"; then
    echo "FAIL: expected non-docs failure for: $*" >&2
    exit 1
  fi
  echo "ok (not docs): $*"
  git reset --hard HEAD~1 >/dev/null
}

with_repo assert_docs README.md docs/guide.md
with_repo assert_docs assets/logo.svg
with_repo assert_not_docs README.md src/foo.ts
with_repo assert_not_docs CODEOWNERS
with_repo assert_not_docs .github/workflows/ci.yml

echo "test_is_docs_only_changes: all passed"
