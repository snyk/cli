#!/usr/bin/env bash
# Verifies that the FIPS build actually produced a binary distinct from the
# normal build.
#
# Why this exists: the normal and FIPS builds compile to the same intermediate
# output path and are only distinguished by the crypto backend. If a regression
# (e.g. removing `clean-golang` combined with a stale build output) caused the
# FIPS build to be skipped, the FIPS and normal binaries would be byte-identical.
# This script fails loudly in that case, and logs the Go build settings of both
# binaries so a human can confirm the FIPS crypto backend is present.
#
# Usage: verify-fips-build.sh <normal-dir> <fips-dir>
set -euo pipefail

normal_dir="${1:?normal binary directory required}"
fips_dir="${2:?fips binary directory required}"

# Load Windows env (PATH for go) if running on the Windows executor.
if [ -f "/c/tools-cache/snyk-env.sh" ]; then
  # shellcheck disable=SC1091
  source "/c/tools-cache/snyk-env.sh"
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

# Informational: Microsoft's Go toolchain records GOEXPERIMENT=systemcrypto for
# FIPS builds. Absence is not treated as fatal (toolchain behaviour may vary),
# but it is surfaced clearly.
if go version -m "$fips_bin" 2>/dev/null | grep -qi 'systemcrypto'; then
  echo "[verify-fips] FIPS indicator: 'systemcrypto' FOUND in FIPS binary build info."
else
  echo "[verify-fips] WARNING: 'systemcrypto' NOT found in FIPS binary build info."
fi

# Authoritative gate: the FIPS and normal binaries must differ. Identical bytes
# mean the FIPS build did not take effect (e.g. it was skipped).
normal_hash="$(hash_file "$normal_bin")"
fips_hash="$(hash_file "$fips_bin")"
echo "[verify-fips] normal sha256: $normal_hash"
echo "[verify-fips] fips   sha256: $fips_hash"

if [ "$normal_hash" = "NOHASH" ]; then
  echo "[verify-fips] WARNING: no sha256 tool available; skipping byte-difference gate."
  echo "[verify-fips] Review the build settings above to confirm the FIPS backend."
  exit 0
fi

if [ "$normal_hash" = "$fips_hash" ]; then
  echo "=================================================================="
  echo "[verify-fips] FAILED: FIPS and normal binaries are IDENTICAL."
  echo "[verify-fips] The FIPS build did not take effect (was it skipped?)."
  exit 1
fi

echo "=================================================================="
echo "[verify-fips] PASSED: FIPS binary is distinct from the normal binary."
