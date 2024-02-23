#!/usr/bin/env bash
set -uo pipefail

VERSION_TAG="$(cat binary-releases/version)"

echo "-----------------------------------------------------------------"
echo "| Running sanity checks on the repository before releasing"
echo "| Checking Version: ${VERSION_TAG}"
echo "| "

TAG_FOUND=$(git -P tag --list --contains)
if [ "${TAG_FOUND}" != "" ]; then
    echo "| [FAIL] The current commit has already been tagged and released!"
    exit 1
fi
echo "| [PASS] The commit looks good!"


git tag | grep v${VERSION_TAG}
retVal=$?
if [ $retVal -ne 1 ]; then
    echo "| [FAIL] The version has already been released to github. If there are any changes available, they might not have notable value, use feat: and fix: commit prefix to indicate important change."
    exit 1
fi

npm view snyk versions | grep ${VERSION_TAG}
retVal=$?
if [ $retVal -ne 1 ]; then
    echo "| [FAIL] The version has already been released to npm."
    exit 1
fi

echo "| [PASS] The version is new!"
echo "| "
echo "| Summary: The Version is ready to release!"
echo "-----------------------------------------------------------------"