#!/usr/bin/env bash
set -uo pipefail

LOG_PREFIX="--- $(basename "$0"):"

if [[ "$OSTYPE" != *"darwin"* ]]; then
  echo "$LOG_PREFIX ERROR! This script needs to be run on macOS!"
  exit 1
fi

if ! codesign --verify --deep --strict "$1"; then
  echo "$LOG_PREFIX NOT signed!"
  exit 1
else
  echo "$LOG_PREFIX is signed!"
fi
