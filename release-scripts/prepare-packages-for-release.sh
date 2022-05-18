#!/usr/bin/env bash
set -euo pipefail

BUILD_VERSION="$(cat binary-releases/version)"
npm version "${BUILD_VERSION}" --no-git-tag-version --workspaces --include-workspace-root
npx ts-node ./release-scripts/prune-dependencies-in-packagejson.ts
