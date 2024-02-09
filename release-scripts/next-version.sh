#!/usr/bin/env bash
set -euo pipefail
# Checks the latest version of Snyk CLI on npm and decides the next version.
# Only output the next version to stdout. All other output should go to stderr.

CURRENT_VERSION="$(git describe --tags `git rev-list --tags --max-count=1`)"
RELEASE_BRANCH="master"
if [ "${CIRCLE_BRANCH:-}" == "${RELEASE_BRANCH}" ]; then
    NEXT_VERSION="v$(convco version --bump)"
else
    NEXT_VERSION="${CURRENT_VERSION}-dev.$(git rev-parse HEAD)"
fi
echo "Current version: ${CURRENT_VERSION}" 1>&2
echo "Next version:    ${NEXT_VERSION}" 1>&2

echo "${NEXT_VERSION}"
