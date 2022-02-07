#!/usr/bin/env bash
set -euo pipefail

CURRENT_VERSION="$(npm view snyk version)"
RELEASE_BRANCH="master"
if [ "${CIRCLE_BRANCH}" == "${RELEASE_BRANCH}" ]; then
  NEXT_VERSION="$(npx semver "${CURRENT_VERSION}" -i minor)"
else
  NEXT_VERSION="${CURRENT_VERSION}-dev.$(git rev-parse HEAD)"
fi
echo "Current version: ${CURRENT_VERSION}"
echo "Next version: ${NEXT_VERSION}"

npm version "${NEXT_VERSION}" --no-git-tag-version --workspaces --include-workspace-root
npx ts-node ./release-scripts/prune-dependencies-in-packagejson.ts
