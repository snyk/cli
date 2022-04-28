#!/usr/bin/env bash
set -uo pipefail

LOG_PREFIX="--- $(basename "$0"):"

if ! osslsigncode verify -in "$1"; then
  echo "$LOG_PREFIX NOT signed!"
  exit 1
else
  echo "$LOG_PREFIX is signed!"
fi
