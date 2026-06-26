#!/usr/bin/env bash
# Imports the Snyk CLI release signing public key for gpg --verify.
# Optional env: SNYK_GPG_KEY_FILE (defaults to checkout path or GitHub raw URL)

set -euo pipefail

if ! command -v gpg >/dev/null 2>&1; then
  echo "gpg is required but not installed."
  exit 1
fi

KEY_FILE="${SNYK_GPG_KEY_FILE:-}"
TEMP_KEY=""

cleanup() {
  if [ -n "$TEMP_KEY" ]; then
    rm -f "$TEMP_KEY"
  fi
}
trap cleanup EXIT

if [ -z "$KEY_FILE" ]; then
  WORKSPACE="${GITHUB_WORKSPACE:-}"
  if [ -n "$WORKSPACE" ] && [ -f "${WORKSPACE}/help/_about-this-project/snyk-code-signing-public.pgp" ]; then
    KEY_FILE="${WORKSPACE}/help/_about-this-project/snyk-code-signing-public.pgp"
  else
    TEMP_KEY="$(mktemp "${TMPDIR:-/tmp}/snyk-public.XXXXXX.pgp")"
    curl --retry 2 -sSL \
      "https://raw.githubusercontent.com/snyk/cli/main/help/_about-this-project/snyk-code-signing-public.pgp" \
      -o "$TEMP_KEY"
    KEY_FILE="$TEMP_KEY"
  fi
fi

if [ ! -s "$KEY_FILE" ]; then
  echo "Snyk GPG public key file is missing or empty: ${KEY_FILE}"
  exit 1
fi

gpg --batch --import "$KEY_FILE" >/dev/null
