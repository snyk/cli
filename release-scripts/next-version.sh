#!/usr/bin/env bash
set -euo pipefail
# Checks the latest version of Snyk CLI on npm and decides the next version.
# Only output the next version to stdout. All other output should go to stderr.
#
# Environment variables:
#   BUILD_MODE - "public" or "private" (default: "private")
#                Public builds get an "-oss" suffix appended to the version.

NEXT_VERSION="$(convco version --bump)"
CURRENT_TAG="$(git describe --tags `git rev-list --tags --max-count=1`)"
RELEASE_CHANNEL="$($(dirname "$0")/determine-release-channel.sh)"

valid_version_postfixes=("preview" "rc" "dev")
postfix=""

if [ "$RELEASE_CHANNEL" != "" ]; then
  # Check if the input string is in the list of valid strings
  for valid_str in "${valid_version_postfixes[@]}"; do
    if [ "$RELEASE_CHANNEL" == "$valid_str" ]; then
        postfix="-$RELEASE_CHANNEL.$(git rev-parse HEAD)"
        break
    fi
  done
fi

NEXT_VERSION="${NEXT_VERSION}${postfix}"

# Append oss suffix for public/OSS builds
# - For stable versions (no pre-release): use "-oss" to create a pre-release
# - For pre-release versions: use ".oss" to add another identifier
if [ "${BUILD_MODE:-}" == "public" ]; then
  if [[ "$NEXT_VERSION" == *-* ]]; then
    # Already has pre-release, append as dot-separated identifier
    NEXT_VERSION="${NEXT_VERSION}.oss"
  else
    # Stable version, start pre-release with hyphen
    NEXT_VERSION="${NEXT_VERSION}-oss"
  fi
fi

echo "Current version: ${CURRENT_TAG/v/}" 1>&2
echo "Next version:    ${NEXT_VERSION}" 1>&2
echo "Build mode:      ${BUILD_MODE:-private}" 1>&2

echo "${NEXT_VERSION}"
