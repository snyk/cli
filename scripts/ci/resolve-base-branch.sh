#!/usr/bin/env bash
# Print the branch to diff against for CI path routing (PR base, else main).
set -euo pipefail

if [ -n "${CIRCLE_PULL_REQUEST_BASE_BRANCH:-}" ]; then
  echo "$CIRCLE_PULL_REQUEST_BASE_BRANCH"
  exit 0
fi

pr_number="${CIRCLE_PR_NUMBER:-}"
repo_path=""
if [ -n "${CIRCLE_PULL_REQUEST:-}" ]; then
  pr_number="${pr_number:-${CIRCLE_PULL_REQUEST##*/}}"
  repo_path="${CIRCLE_PULL_REQUEST#*github.com/}"
  repo_path="${repo_path%/pull/*}"
fi
if [ -z "$repo_path" ] && [ -n "${CIRCLE_PROJECT_USERNAME:-}" ] && [ -n "${CIRCLE_PROJECT_REPONAME:-}" ]; then
  repo_path="${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}"
fi

token="${GITHUB_TOKEN:-${GITHUB_PRIVATE_TOKEN:-${HAMMERHEAD_GITHUB_PAT:-}}}"
if [ -n "$token" ] && [ -n "$pr_number" ] && [ -n "$repo_path" ]; then
  base_ref="$(
    curl -fsSL -H "Authorization: Bearer ${token}" -H 'Accept: application/vnd.github+json' \
      "https://api.github.com/repos/${repo_path}/pulls/${pr_number}" \
      | python3 -c 'import json,sys; print(json.load(sys.stdin)["base"]["ref"])'
  )"
  if [ -n "$base_ref" ]; then
    echo "$base_ref"
    exit 0
  fi
fi

echo main
