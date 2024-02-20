#!/usr/bin/env bash
set -uo pipefail

VERSION_TAG="$(cat binary-releases/version)"

TAG_FOUND=$(git -P tag --list --contains)
if [ "${TAG_FOUND}" != "" ]; then
    echo "This commit has already been released."
    exit 1
fi

git tag | grep v${VERSION_TAG}
retVal=$?
if [ $retVal -ne 1 ]; then
    echo "Version ${VERSION_TAG} has already been released to github."
    exit 1
fi

npm view snyk versions | grep ${VERSION_TAG}
retVal=$?
if [ $retVal -ne 1 ]; then
    echo "Version ${VERSION_TAG} has already been released to npm."
    exit 1
fi

echo "Version ${VERSION_TAG} LGTM!"
