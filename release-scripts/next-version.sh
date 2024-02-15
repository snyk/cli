#!/usr/bin/env bash
set -euo pipefail
# Checks the latest version of Snyk CLI on npm and decides the next version.
# Only output the next version to stdout. All other output should go to stderr.

RELEASE_BRANCH="main"
NEXT_VERSION="$(convco version --bump)"
CURRENT_TAG="$(git describe --tags `git rev-list --tags --max-count=1`)"

if [ "${CIRCLE_BRANCH:-}" != "${RELEASE_BRANCH}" ]; then
    NEXT_VERSION="${NEXT_VERSION}-dev.$(git rev-parse HEAD)"
fi

echo "Current version: ${CURRENT_TAG/v/}" 1>&2
echo "Next version:    ${NEXT_VERSION}" 1>&2

echo "${NEXT_VERSION}"
