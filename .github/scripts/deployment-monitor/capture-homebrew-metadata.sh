#!/usr/bin/env bash
# Captures version and sha256 metadata for the Homebrew distribution channel (macOS).
# Required env: SNYK_VERSION_DIR, METADATA_SUFFIX

if [[ -n "${CI:-}" ]]; then
  set -euo pipefail
else
  set -exuo pipefail
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS_DIR="${SCRIPT_DIR}/helpers"

: "${SNYK_VERSION_DIR:?SNYK_VERSION_DIR is required}"
: "${METADATA_SUFFIX:?METADATA_SUFFIX is required}"

VERSION="$(snyk --version | tr -d '\r\n')"
SNYK_PATH="$(command -v snyk)"
SHA256="$(shasum -a 256 "$SNYK_PATH" | awk '{print $1}')"
BINARY_NAME="$(
  SNYK_PATH="$SNYK_PATH" bash "${HELPERS_DIR}/resolve-macos-binary-name.sh"
)"

RELEASE_JSON="${GITHUB_WORKSPACE:-$(pwd)}/release.json"
RELEASE_URL="https://static.snyk.io/cli/v${VERSION}/release.json"
HTTP_STATUS="$(
  curl --retry 2 -sSL "$RELEASE_URL" -w '%{http_code}' -o "$RELEASE_JSON"
)"
if [ "$HTTP_STATUS" != "200" ]; then
  echo "Failed to download release.json from ${RELEASE_URL} (HTTP ${HTTP_STATUS})."
  exit 1
fi
EXPECTED="$(
  BINARY_NAME="$BINARY_NAME" go run -C "${SCRIPT_DIR}" ./cmd/extract-release-json-hash "$RELEASE_JSON"
)"

if [ -z "$EXPECTED" ]; then
  echo "Missing expected hash for ${BINARY_NAME} in release.json."
  exit 1
fi

if [ "$SHA256" != "$EXPECTED" ]; then
  echo "Hash mismatch for ${BINARY_NAME} (homebrew)."
  echo "Expected: $EXPECTED"
  echo "Actual:   $SHA256"
  exit 1
fi

SNYK_VERSION_DIR="$SNYK_VERSION_DIR" \
  METADATA_SUFFIX="$METADATA_SUFFIX" \
  VERSION="$VERSION" \
  SHA256="$SHA256" \
  CHANNEL="stable" \
  BASE_URL="static.snyk.io" \
  SOURCE="homebrew" \
  BINARY_NAME="$BINARY_NAME" \
  bash "${HELPERS_DIR}/write-metadata.sh"
