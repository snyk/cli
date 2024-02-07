#!/usr/bin/env bash
set -euo pipefail
# Checks the latest version of Snyk CLI on npm and decides the next version.
# Only output the next version to stdout. All other output should go to stderr.

CURRENT_VERSION="$(npm view snyk version)"
RELEASE_BRANCH="master"
if [ "${CIRCLE_BRANCH:-}" == "${RELEASE_BRANCH}" ]; then
    # Note that the output file here is determind by
    # the configuration in .releaserc.json
    echo "On release branch, incrementing version semantic-release in dry-run" 1>&2
    npx semantic-release@22 --dry-run --quiet
else
    echo "Not on release branch, creating dev version" 1>&2
    echo "${CURRENT_VERSION}-dev.$(git rev-parse HEAD)" > "$BINARY_OUTPUT_FOLDER/version"
fi
echo "Current version: ${CURRENT_VERSION}" 1>&2
echo "Next version:    $(cat "$BINARY_OUTPUT_FOLDER/version")" 1>&2

echo "Updated $BINARY_OUTPUT_FOLDER/version" 1>&2
