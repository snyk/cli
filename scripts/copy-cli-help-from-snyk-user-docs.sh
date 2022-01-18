#!/usr/bin/env bash
set -euo pipefail

gh repo clone snyk/snyk cli -- --depth=1
gh repo clone snyk/user-docs docs -- --depth=1
git -C ./cli checkout -b docs/automatic-gitbook-update

cp ./docs/docs/features/snyk-cli/commands/*.md ./cli/help/cli-commands/

if [[ $(git -C ./cli status --porcelain) ]]; then
  echo "Documentation changes detected, opening a PR"
  git -C ./cli --no-pager diff --name-only
  git -C ./cli add .
  git -C ./cli commit -m "docs: synchronized help from snyk/user-docs"
  gh pr create --title="Synchronizing CLI help from user-docs" --body="Automatic PR controlled by GitHub Action"
else
  echo "No documentation changes detected, exiting"
fi
