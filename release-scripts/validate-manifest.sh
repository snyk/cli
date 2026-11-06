#!/usr/bin/env bash
set -euo pipefail

# Fails unless binary-releases is the build its artifacts manifest describes: the same version,
# the same commit, and the same bytes for every artifact.

MANIFEST="binary-releases/artifacts-manifest.json"
VERSION="$(tr -d '[:space:]' < binary-releases/version)"
COMMIT="${CIRCLE_SHA1:-$(git rev-parse HEAD)}"

MANIFEST_VERSION="$(jq -er '.meta.version' "${MANIFEST}")"
if [ "${MANIFEST_VERSION}" != "${VERSION}" ]; then
  echo "${MANIFEST} is for version ${MANIFEST_VERSION}, but binary-releases/version is ${VERSION}" >&2
  exit 1
fi

MANIFEST_COMMIT="$(jq -er '.meta.commit' "${MANIFEST}")"
if [ "${MANIFEST_COMMIT}" != "${COMMIT}" ]; then
  echo "${MANIFEST} is for commit ${MANIFEST_COMMIT}, but this build is ${COMMIT}" >&2
  exit 1
fi

cd binary-releases
jq -er '.artifacts[] | "\(.sha256)  \(.name)"' artifacts-manifest.json | shasum -a 256 -c --quiet -
echo "binary-releases matches ${MANIFEST} (${VERSION}, ${COMMIT})"
