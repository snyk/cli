#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
HAS_CODE="$SCRIPT_DIR/has-code-changes.sh"

# ponytail: temp repo exercises real git diff + pathspecs (no hand-rolled pattern matcher).
with_repo() {
  local dir
  dir=$(mktemp -d)
  trap 'rm -rf "$dir"' RETURN

  cp "$SCRIPT_DIR/has-code-changes.sh" "$SCRIPT_DIR/list-changed-files.sh" "$dir/"
  chmod +x "$dir"/*.sh

  cd "$dir"
  git init -q
  git config user.email 'ci-test@example.com'
  git config user.name 'ci-test'
  echo base >README.md
  git add . && git commit -qm base

  export BASE_REF=HEAD
  export LIGHT_PIPELINE_PATHSPECS_FILE="$SCRIPT_DIR/light-pipeline-pathspecs.txt"
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

assert_light() {
  commit_paths "$@"
  if BASE_REF=HEAD~1 "$HAS_CODE"; then
    echo "FAIL: expected light pipeline for: $*" >&2
    exit 1
  fi
  echo "ok (light): $*"
  git reset --hard HEAD~1 >/dev/null
}

assert_full() {
  commit_paths "$@"
  if ! BASE_REF=HEAD~1 "$HAS_CODE"; then
    echo "FAIL: expected full pipeline for: $*" >&2
    exit 1
  fi
  echo "ok (full): $*"
  git reset --hard HEAD~1 >/dev/null
}

with_repo assert_light CONTRIBUTING.md .github/CODEOWNERS
with_repo assert_light README.md docs/guide.md
with_repo assert_light test/fixtures/pnpm-app/node_modules/.pnpm/foo/index.mjs
with_repo assert_light .circleci/continue_config_light.yml
with_repo assert_light .github/workflows/ci.yml

with_repo assert_full src/cli/main.ts
with_repo assert_full cliv2/pkg/foo/bar.go
with_repo assert_full scripts/install-dev-dependencies.sh
with_repo assert_full Makefile
with_repo assert_full cliv2/Makefile
with_repo assert_full cliv2/go.mod
with_repo assert_full cliv2/go.sum
with_repo assert_full package.json
with_repo assert_full packages/foo/package-lock.json
with_repo assert_full .circleci/config.yml
with_repo assert_full .circleci/continue_config.yml
with_repo assert_full .nvmrc
with_repo assert_full dangerfile.js
with_repo assert_full CONTRIBUTING.md src/foo.ts
with_repo assert_full Dockerfile
with_repo assert_full foo.py
with_repo assert_full cliv2-private/go.mod

echo "test_has_code_changes: all passed"
