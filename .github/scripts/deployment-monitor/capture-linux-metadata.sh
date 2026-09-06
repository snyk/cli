#!/usr/bin/env bash
# Captures version and sha256 metadata for Linux-based distribution channels (npm, snyk-images).
# Required env: SNYK_VERSION_DIR, METADATA_SUFFIX, SOURCE, MANIFEST_MODE (stable|experimental)
# Optional env: SKIP_HASH_IF_NOT_ELF (set to 1 for npm)

if [[ -n "${CI:-}" ]]; then
  set -euo pipefail
else
  set -exuo pipefail
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS_DIR="${SCRIPT_DIR}/helpers"

: "${SNYK_VERSION_DIR:?SNYK_VERSION_DIR is required}"
: "${METADATA_SUFFIX:?METADATA_SUFFIX is required}"
: "${SOURCE:?SOURCE is required}"
: "${MANIFEST_MODE:?MANIFEST_MODE is required}"

BASE_URL="downloads.snyk.io"

VERSION="$(snyk --version | tr -d '\r\n')"
SNYK_PATH="$(command -v snyk)"
BINARY_NAME="$(bash "${HELPERS_DIR}/resolve-linux-binary-name.sh")"

if [ "${SKIP_HASH_IF_NOT_ELF:-}" = "1" ]; then
  IS_ELF="$(go run -C "${SCRIPT_DIR}" ./cmd/is-elf-binary "$SNYK_PATH")"
  if [ "$IS_ELF" != "1" ]; then
    echo "Non-binary CLI detected for ${SOURCE}; skipping shasum metadata."
    SNYK_VERSION_DIR="$SNYK_VERSION_DIR" \
      METADATA_SUFFIX="$METADATA_SUFFIX" \
      VERSION="$VERSION" \
      SHA256="" \
      CHANNEL="stable" \
      BASE_URL="$BASE_URL" \
      SOURCE="$SOURCE" \
      BINARY_NAME="$BINARY_NAME" \
      bash "${HELPERS_DIR}/write-metadata.sh"
    exit 0
  fi
fi

SHA256="$(shasum -a 256 "$SNYK_PATH" | awk '{print $1}')"

case "$MANIFEST_MODE" in
  stable)
    MANIFEST_URL="https://downloads.snyk.io/cli/stable/sha256sums.txt.asc"
    MISSING_HASH_MSG="Missing expected hash for ${BINARY_NAME} in manifest."
    ;;
  experimental)
    MANIFEST_URL="https://downloads.snyk.io/experimental/cli/v${VERSION}/sha256sums.txt.asc"
    MISSING_HASH_MSG="Missing expected hash for ${BINARY_NAME} in experimental manifest."
    ;;
  *)
    echo "Unknown MANIFEST_MODE: ${MANIFEST_MODE} (expected stable or experimental)"
    exit 1
    ;;
esac

MANIFEST_FILE="$(mktemp "${TMPDIR:-/tmp}/sha256sums.XXXXXX")"
trap 'rm -f "$MANIFEST_FILE"' EXIT

HTTP_STATUS="$(
  curl --retry 2 -sSL -w '%{http_code}' -o "$MANIFEST_FILE" "$MANIFEST_URL"
)"
if [ "$HTTP_STATUS" != "200" ]; then
  echo "Failed to download manifest from ${MANIFEST_URL} (HTTP ${HTTP_STATUS})."
  exit 1
fi
if [ ! -s "$MANIFEST_FILE" ]; then
  echo "Downloaded manifest from ${MANIFEST_URL} is empty."
  exit 1
fi

MANIFEST_FILE="$MANIFEST_FILE" bash "${HELPERS_DIR}/verify-asc-manifest.sh"

EXPECTED="$(
  MANIFEST_FILE="$MANIFEST_FILE" BINARY_NAME="$BINARY_NAME" \
    bash "${HELPERS_DIR}/lookup-hash-from-asc-manifest.sh"
)"

if [ -z "$EXPECTED" ]; then
  echo "$MISSING_HASH_MSG"
  exit 1
fi

if [ "$SHA256" != "$EXPECTED" ]; then
  echo "Hash mismatch for ${BINARY_NAME} (${SOURCE})."
  echo "Expected: $EXPECTED"
  echo "Actual:   $SHA256"
  exit 1
fi

SNYK_VERSION_DIR="$SNYK_VERSION_DIR" \
  METADATA_SUFFIX="$METADATA_SUFFIX" \
  VERSION="$VERSION" \
  SHA256="$SHA256" \
  CHANNEL="stable" \
  BASE_URL="$BASE_URL" \
  SOURCE="$SOURCE" \
  BINARY_NAME="$BINARY_NAME" \
  bash "${HELPERS_DIR}/write-metadata.sh"
