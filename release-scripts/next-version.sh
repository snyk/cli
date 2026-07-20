#!/usr/bin/env bash
set -euo pipefail
# Checks the latest version of Snyk CLI on npm and decides the next version.
# Only output the next version to stdout. All other output should go to stderr.
#
# Environment variables:
#   BUILD_MODE - "public" or "private" (default: "private")
#                Public builds get an "-oss" suffix appended to the version.
#
# Modes:
#   (default)            Generate the next version and print it to stdout.
#   --verify <version>   Check that <version> is consistent with BUILD_MODE.
#                        Exits 0 if consistent, 1 if not. No git/convco needed.

if [ "${1:-}" = "--verify" ]; then
  VERSION="${2:?Usage: next-version.sh --verify <version> (BUILD_MODE must be set)}"
  MODE="${BUILD_MODE:-private}"
  HAS_OSS=false
  if echo "$VERSION" | grep -qE '[-.]oss$'; then
    HAS_OSS=true
  fi
  if [ "$MODE" = "private" ] && [ "$HAS_OSS" = "true" ]; then
    echo "ERROR: BUILD_MODE=$MODE but version '$VERSION' contains oss suffix." >&2
    echo "       Version was generated for a public build." >&2
    exit 1
  fi
  if [ "$MODE" = "public" ] && [ "$HAS_OSS" = "false" ]; then
    echo "ERROR: BUILD_MODE=$MODE but version '$VERSION' is missing oss suffix." >&2
    echo "       Version was generated for a private build." >&2
    exit 1
  fi
  exit 0
fi

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
