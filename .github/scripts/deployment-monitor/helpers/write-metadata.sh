#!/usr/bin/env bash
# Writes snyk-version and snyk-metadata artifact files.
# Required env: SNYK_VERSION_DIR, METADATA_SUFFIX, VERSION, CHANNEL, BASE_URL, BINARY_NAME
# Optional env: SHA256 (when empty, shasum comparison is skipped downstream), SOURCE (defaults to BASE_URL)

set -euo pipefail

: "${SNYK_VERSION_DIR:?SNYK_VERSION_DIR is required}"
: "${METADATA_SUFFIX:?METADATA_SUFFIX is required}"
: "${VERSION:?VERSION is required}"
: "${CHANNEL:?CHANNEL is required}"
: "${BASE_URL:?BASE_URL is required}"
: "${BINARY_NAME:?BINARY_NAME is required}"

SHA256="${SHA256:-}"
SOURCE="${SOURCE:-${BASE_URL}}"

if [[ "${SNYK_VERSION_DIR}" != /* ]]; then
  SNYK_VERSION_DIR="${GITHUB_WORKSPACE:-$(pwd)}/${SNYK_VERSION_DIR}"
fi

mkdir -p "${SNYK_VERSION_DIR}"

echo "$VERSION" >"${SNYK_VERSION_DIR}/snyk-version-${METADATA_SUFFIX}.txt"
cat <<EOF >"${SNYK_VERSION_DIR}/snyk-metadata-${METADATA_SUFFIX}.json"
{"channel":"${CHANNEL}","base_url":"${BASE_URL}","source":"${SOURCE}","binary":"${BINARY_NAME}","version":"${VERSION}","sha256":"${SHA256}"}
EOF
