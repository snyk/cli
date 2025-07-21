#!/usr/bin/env bash
set -uo pipefail

VERSION_TAG="$(cat binary-releases/version | tr -d '[:space:]')"
RELEASE_NOTES_MD="./binary-releases/RELEASE_NOTES.md"

# Check if version is a stable release (clean semver without pre-release identifiers)
IS_STABLE_RELEASE=false
if [[ "$VERSION_TAG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    IS_STABLE_RELEASE=true
fi

echo "-----------------------------------------------------------------"
echo "| Running sanity checks on the repository before releasing"
echo "| Checking Version: ${VERSION_TAG} $(if [ "$IS_STABLE_RELEASE" = true ]; then echo "(stable)"; fi)"
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

if [ -f "$RELEASE_NOTES_MD" ]; then
    header_line=$(head -n 1 "$RELEASE_NOTES_MD")
    RELEASE_VERSION=$(echo "$header_line" | sed 's/.*# \[\([^]]*\)\].*/\1/')

    # Check if version extraction was successful
    if [ -z "$RELEASE_VERSION" ] || [ "$RELEASE_VERSION" = "$header_line" ]; then
        echo "| [FAIL] Could not extract version from release notes header: $header_line"
        exit 1
    fi

    # Use string comparison instead of regex for more reliable prefix matching
    if [[ ! "$VERSION_TAG" == "$RELEASE_VERSION"* ]]; then
        echo "| [FAIL] Version mismatch:"
        echo "|   Binary: $VERSION_TAG"
        echo "|   Release notes: $RELEASE_VERSION"
        exit 1
    fi
    echo "| [PASS] Release notes version matches binary version!"
fi

echo "| [PASS] The version is new!"
echo "| "
echo "| Summary: The Version is ready to release!"
echo "-----------------------------------------------------------------"