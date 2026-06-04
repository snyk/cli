#!/usr/bin/env bash
# Prints the macOS binary asset name (snyk-macos or snyk-macos-arm64) to stdout.
# Required env: SNYK_PATH

: "${SNYK_PATH:?SNYK_PATH is required}"

FILE_INFO="$(file "$SNYK_PATH")"
if echo "$FILE_INFO" | grep -qi "arm64"; then
  echo "snyk-macos-arm64"
elif echo "$FILE_INFO" | grep -qi "x86_64"; then
  echo "snyk-macos"
else
  ARCH="$(uname -m)"
  if [ "$ARCH" = "arm64" ]; then
    echo "snyk-macos-arm64"
  else
    echo "snyk-macos"
  fi
fi
