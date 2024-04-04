#!/usr/bin/env bash
set -euo pipefail

# This script automates the process of creating a hotfix branch from the latest
# tagged release, cherry-picking the necessary commits, and creating a pull

RELEASE_BRANCH="main"
CURRENT_TAG="$(git describe --tags `git rev-list --tags --max-count=1`)"

# Create a new branch from the latest tag
HOTFIX_BRANCH="hotfix/$CURRENT_TAG-$(date +%s)"
git checkout -b $HOTFIX_BRANCH $CURRENT_TAG