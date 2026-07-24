#!/usr/bin/env bash
set -uo pipefail

LOG_PREFIX="--- $(basename "$0"):"

if [[ "$OSTYPE" != *"darwin"* ]]; then
  echo "$LOG_PREFIX ERROR! This script needs to be run on macOS!"
  exit 1
fi

if [[ $# -eq 0 ]]; then
  echo "$LOG_PREFIX ERROR! Usage: $0 <file> [file...]"
  exit 1
fi

status=0
for file in "$@"; do
  if ! codesign --verify --deep --strict "$file"; then
    echo "$LOG_PREFIX NOT signed: $file"
    status=1
  else
    echo "$LOG_PREFIX is signed: $file"
  fi
done

exit $status
