#!/usr/bin/env bash
set -euo pipefail
# Checks the latest version of Snyk CLI on npm and decides the next version.
# Only output the next version to stdout. All other output should go to stderr.

CURRENT_VERSION="$(npm view snyk version)"
RELEASE_BRANCH="master"
if [ "${CIRCLE_BRANCH:-}" == "${RELEASE_BRANCH}" ]; then
    NEXT_VERSION="$(npx semver "${CURRENT_VERSION}" -i minor)"
else
    NEXT_VERSION="${CURRENT_VERSION}-dev.$(git rev-parse HEAD)"
fi
echo "Current version: ${CURRENT_VERSION}" 1>&2
echo "Next version:    ${NEXT_VERSION}" 1>&2

echo "${NEXT_VERSION}"
