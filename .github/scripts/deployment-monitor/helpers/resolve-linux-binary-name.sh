#!/usr/bin/env bash
# Prints the Linux binary asset name (snyk-linux or snyk-linux-arm64) to stdout.

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
  echo "snyk-linux-arm64"
else
  echo "snyk-linux"
fi
