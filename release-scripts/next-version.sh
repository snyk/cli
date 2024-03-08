#!/usr/bin/env bash
set -euo pipefail
# Checks the latest version of Snyk CLI on npm and decides the next version.
# Only output the next version to stdout. All other output should go to stderr.

RELEASE_BRANCH="main"
NEXT_VERSION="$(convco version --bump)"
CURRENT_TAG="$(git describe --tags `git rev-list --tags --max-count=1`)"
RELEASE_CHANNEL="$($(dirname "$0")/determine-release-channel.sh)"

valid_version_postfixes=("preview" "rc")
postfix="-dev.$(git rev-parse HEAD)"

if [ "$RELEASE_CHANNEL" != "" ]; then
  # Check if the input string is in the list of valid strings
  for valid_str in "${valid_version_postfixes[@]}"; do
    if [ "$RELEASE_CHANNEL" == "$valid_str" ]; then
        postfix="-$RELEASE_CHANNEL"
        break
    fi
  done
fi

if [ "$RELEASE_CHANNEL" == "stable" ]; then
  postfix=""
fi

NEXT_VERSION="${NEXT_VERSION}${postfix}"

echo "Current version: ${CURRENT_TAG/v/}" 1>&2
echo "Next version:    ${NEXT_VERSION}" 1>&2

echo "${NEXT_VERSION}"
