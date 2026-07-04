#!/usr/bin/env bash
# pinned sbt 1.x for acceptance tests; snyk-sbt-plugin does not support sbt 2.x
set -euo pipefail

SBT_VERSION="1.12.11"
SBT_SHA256="5f972a79d2a5bf8f29141a74c35e686bb0860a6b6ec677af892f94cf9b124645"
SBT_HOME="${SBT_HOME:-${HOME}/sbt}"

download() {
  if command -v wget >/dev/null 2>&1; then
    wget -qO "$2" "$1"
  else
    curl -fsSL -o "$2" "$1"
  fi
}

if [ ! -x "${SBT_HOME}/bin/sbt" ] || [[ "$("${SBT_HOME}/bin/sbt" --version 2>&1 || true)" != *"${SBT_VERSION}"* ]]; then
  echo "Installing sbt ${SBT_VERSION} to ${SBT_HOME}"
  base="https://github.com/sbt/sbt/releases/download/v${SBT_VERSION}"
  tarball="/tmp/sbt-${SBT_VERSION}.tgz"
  download "${base}/sbt-${SBT_VERSION}.tgz" "${tarball}"
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "${tarball}" | awk '{print $1}')
  else
    actual=$(shasum -a 256 "${tarball}" | awk '{print $1}')
  fi
  if [ "${actual}" != "${SBT_SHA256}" ]; then
    echo "ERROR: checksum verification failed for ${tarball}"
    echo "Expected: ${SBT_SHA256}"
    echo "Actual:   ${actual}"
    exit 1
  fi
  rm -rf "${SBT_HOME}"
  tar xzf "${tarball}" -C "${HOME}"
fi

if [ -n "${BASH_ENV:-}" ]; then
  echo "export PATH=\"${SBT_HOME}/bin:\$PATH\"" >> "$BASH_ENV"
fi
export PATH="${SBT_HOME}/bin:${PATH}"
sbt --version
