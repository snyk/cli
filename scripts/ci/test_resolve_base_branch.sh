#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
RESOLVE="$SCRIPT_DIR/resolve-base-branch.sh"

assert_eq() {
  local expected="$1"
  shift
  local actual
  actual="$("$@")"
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: expected '$expected', got '$actual' ($*)" >&2
    exit 1
  fi
  echo "ok: $* -> $actual"
}

assert_eq main env -i HOME="$HOME" PATH="$PATH" "$RESOLVE"
assert_eq feat/CLI-1625 env -i HOME="$HOME" PATH="$PATH" CIRCLE_PULL_REQUEST_BASE_BRANCH=feat/CLI-1625 "$RESOLVE"

echo "test_resolve_base_branch: all passed"
