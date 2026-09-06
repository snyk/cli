#!/usr/bin/env bash
# Looks up the expected sha256 for BINARY_NAME in a sha256sums.txt.asc manifest.
# The manifest signature must be verified first (see verify-asc-manifest.sh).
# Required env: MANIFEST_FILE, BINARY_NAME
# Prints the hash to stdout.

: "${MANIFEST_FILE:?MANIFEST_FILE is required}"
: "${BINARY_NAME:?BINARY_NAME is required}"

awk -v name="$BINARY_NAME" '$1 ~ /^[a-f0-9]{64}$/ {gsub(/^\*/, "", $2); if ($2==name) {print $1; exit}}' "$MANIFEST_FILE"
