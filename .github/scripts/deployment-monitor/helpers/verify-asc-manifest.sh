#!/usr/bin/env bash
# Verifies a clearsigned sha256sums manifest with gpg before hash lookup.
# Required env: MANIFEST_FILE

set -euo pipefail

: "${MANIFEST_FILE:?MANIFEST_FILE is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -s "$MANIFEST_FILE" ]; then
  echo "Manifest file is missing or empty: ${MANIFEST_FILE}"
  exit 1
fi

bash "${SCRIPT_DIR}/import-snyk-gpg-key.sh"
gpg --verify "$MANIFEST_FILE"
