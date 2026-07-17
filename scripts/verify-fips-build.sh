#!/usr/bin/env bash
# Verifies that the FIPS build actually produced a FIPS binary that is distinct
# from the normal build.
#
# Why this exists: the normal and FIPS builds compile to the same intermediate
# output path and are only distinguished by the crypto backend. If a regression
# (e.g. removing `clean-golang` combined with a stale build output) caused the
# FIPS build to be skipped, the FIPS binary would just be a copy of the normal
# one. This script fails loudly in that case.
#
# Two independent gates, both must pass:
#   1. The FIPS binary's embedded Go build info must show a FIPS crypto backend
#      (GOEXPERIMENT=systemcrypto/cngcrypto/opensslcrypto/boringcrypto).
#   2. The FIPS binary must be byte-different from the normal binary.
#
# The script never exits 0 unless it could actually perform these checks.
#
# Usage: verify-fips-build.sh <normal-dir> <fips-dir>
set -euo pipefail

normal_dir="${1:?normal binary directory required}"
fips_dir="${2:?fips binary directory required}"

# Best-effort: load the Windows env (PATH for go/sha tools) when running on the
# Windows executor. The caller (e.g. the make-binary step) normally already
# sources this and exports PATH, which this child process inherits; this is a
# fallback for standalone runs. Override the location with SNYK_WIN_ENV_SCRIPT.
win_env_script="${SNYK_WIN_ENV_SCRIPT:-/c/tools-cache/snyk-env.sh}"
if [ -f "$win_env_script" ]; then
  # shellcheck disable=SC1090
  source "$win_env_script"
fi

# The verification depends on the Go toolchain to read embedded build info.
if ! command -v go >/dev/null 2>&1; then
  echo "[verify-fips] ERROR: 'go' not found on PATH; cannot inspect build info. Failing."
  exit 1
fi

find_binary() {
  local dir="$1"
  local f
  shopt -s nullglob
  for f in "$dir"/snyk-*; do
    case "$f" in
      *.sha256 | *.sha256.asc | *.asc) continue ;;
    esac
    [ -f "$f" ] || continue
    echo "$f"
    return 0
  done
  return 1
}

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "NOHASH"
  fi
}

log_build_settings() {
  local label="$1"
  local bin="$2"
  echo "[verify-fips] Build settings ($label): $bin"
  go version -m "$bin" 2>/dev/null | grep -E '^[[:space:]]*build[[:space:]]' || echo "  (no build info available)"
}

# True if the binary's Go build info records a FIPS crypto backend. Microsoft's
# Go toolchain sets this via GOEXPERIMENT; the concrete value is systemcrypto,
# or the platform backend it resolves to (cngcrypto on Windows, opensslcrypto on
# Linux). boringcrypto is included for completeness.
binary_has_fips_backend() {
  go version -m "$1" 2>/dev/null \
    | grep -E '^[[:space:]]*build[[:space:]]+GOEXPERIMENT=' \
    | grep -qiE 'systemcrypto|cngcrypto|opensslcrypto|boringcrypto'
}

normal_bin="$(find_binary "$normal_dir" || true)"
fips_bin="$(find_binary "$fips_dir" || true)"

if [ -z "$normal_bin" ] || [ -z "$fips_bin" ]; then
  echo "[verify-fips] ERROR: could not locate binaries (normal='$normal_bin', fips='$fips_bin')"
  exit 1
fi

echo "=================================================================="
echo "[verify-fips] Normal binary: $normal_bin"
echo "[verify-fips] FIPS   binary: $fips_bin"
echo "------------------------------------------------------------------"
log_build_settings "normal" "$normal_bin"
log_build_settings "fips" "$fips_bin"
echo "------------------------------------------------------------------"

failed=0

# Gate 1: the FIPS binary must actually be built with a FIPS crypto backend.
if binary_has_fips_backend "$fips_bin"; then
  echo "[verify-fips] Gate 1 PASSED: FIPS binary reports a FIPS crypto backend."
else
  echo "[verify-fips] Gate 1 FAILED: FIPS binary does NOT report a FIPS crypto backend (GOEXPERIMENT)."
  echo "[verify-fips] The build under $fips_dir is not FIPS-enabled."
  failed=1
fi

# Sanity: the normal binary should NOT report a FIPS backend. Surface loudly.
if binary_has_fips_backend "$normal_bin"; then
  echo "[verify-fips] WARNING: the normal binary unexpectedly reports a FIPS crypto backend."
fi

# Gate 2: the FIPS and normal binaries must differ. Identical bytes mean the
# FIPS build did not take effect (e.g. it was skipped). If no hashing tool is
# available we cannot perform this gate, so we fail rather than pass silently.
normal_hash="$(hash_file "$normal_bin")"
fips_hash="$(hash_file "$fips_bin")"
echo "[verify-fips] normal sha256: $normal_hash"
echo "[verify-fips] fips   sha256: $fips_hash"

if [ "$normal_hash" = "NOHASH" ] || [ "$fips_hash" = "NOHASH" ]; then
  echo "[verify-fips] Gate 2 FAILED: no sha256 tool available; cannot verify the binaries differ."
  failed=1
elif [ "$normal_hash" = "$fips_hash" ]; then
  echo "[verify-fips] Gate 2 FAILED: FIPS and normal binaries are IDENTICAL (FIPS build skipped?)."
  failed=1
else
  echo "[verify-fips] Gate 2 PASSED: FIPS binary is distinct from the normal binary."
fi

echo "=================================================================="
if [ "$failed" -ne 0 ]; then
  echo "[verify-fips] FAILED: FIPS verification did not pass."
  exit 1
fi
echo "[verify-fips] PASSED: FIPS binary is genuine and distinct from the normal binary."
