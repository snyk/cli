#!/usr/bin/env bash
set -euo pipefail

# This script automates the process of releasing the `release-candidate` branch, 
# validates the current and next versions, and releases the next version.

RC_BRANCH="release-candidate"
DEFAULT_BRANCH="main"

# check if `dry-run` arg is passed
DRY_RUN_MODE=${1:-false}
if [[ $DRY_RUN_MODE == "dry-run" ]]; then
    DRY_RUN_MODE=true
fi

# Checkout Release Candidate branch
git checkout $RC_BRANCH
git pull origin $RC_BRANCH

# Check if the script runs on the ‘release-candidate’ branch, otherwise FAIL
echo "Validating branch..."
if ! git status | grep $RC_BRANCH; then
    echo "Not on branch '$RC_BRANCH', make sure you're on the '$RC_BRANCH' branch and try again."
    exit 1
fi

# Ensure that the next version matches the version in binary-releases/RELEASE_NOTES.md, if not FAIL 
echo "Validating next version..."

# Get version from version file
VERSION_FILE="./binary-releases/version"
CURRENT_VERSION=$(cat "$VERSION_FILE")

# Get version from RELEASE_NOTES.md
RELEASE_NOTES_MD="./binary-releases/RELEASE_NOTES.md"
header_line=$(head -n 1 "$RELEASE_NOTES_MD")
RELEASE_VERSION=$(echo "$header_line" | sed 's/.*# \[\(.*\)\].*/\1/')

# Validate versions are the same
if [[ "$CURRENT_VERSION" != "$RELEASE_VERSION" ]]; then
  echo "Version file version: '$CURRENT_VERSION', is not equal to RELEASE_NOTES.md version: '$RELEASE_VERSION'. Please ensure the versions are equal before continuing."
  exit 1
fi
echo "Current version: $CURRENT_VERSION"
# Check whether a new major, minor, or patch version has been created
echo "Checking for new versions..."

latest_version_full=$(git describe --tags `git rev-list --tags --max-count=1`)
LATEST_VERSION=${latest_version_full:1}
echo "LATEST_VERSION: $LATEST_VERSION"

# Extract major, minor, patch from LATEST_VERSION
IFS="." read -r LATEST_MAJOR LATEST_MINOR LATEST_PATCH <<< "$LATEST_VERSION"
# Extract major, minor, patch from CURRENT_VERSION
IFS="." read -r CURRENT_MAJOR CURRENT_MINOR CURRENT_PATCH <<< "$CURRENT_VERSION"

# Decide whether to create major/minor release or patch release
if [[ "$CURRENT_MAJOR" -gt "$LATEST_MAJOR" || "$CURRENT_MINOR" -gt "$LATEST_MINOR" ]]; then
    # If a new Major or Minor version exists, create a branch based on 
    # the next version following the pattern: release/${Major}.${Minor}
    MAJOR_MINOR_BRANCH=release/${CURRENT_MAJOR}.${CURRENT_MINOR}
    git checkout -b $MAJOR_MINOR_BRANCH

    if [[ $DRY_RUN_MODE == true ]]; then
        echo "Dry running git push"
        git push --dry-run origin $MAJOR_MINOR_BRANCH
    else
        echo "Pushing new release branch '$MAJOR_MINOR_BRANCH'"
        git push origin $MAJOR_MINOR_BRANCH
    fi
elif [[ "$CURRENT_PATCH" -gt "$LATEST_PATCH" ]]; then
    # If only the Patch version changes, update the existing release branch
    PATCH_BRANCH=release/${LATEST_MAJOR}.${LATEST_MINOR}
    # Check if curent release branch (PATCH_BRANCH) is behind release candidate branch
    # merge release candidate branch into current release branch
    git checkout $PATCH_BRANCH
    if git rev-list --left-right --count $RC_BRANCH...$PATCH_BRANCH | awk '{print $1}' | grep -q '[1-9]'; then
        git merge --quiet -m "chore: merge $RC_BRANCH into $PATCH_BRANCH $(date)" --no-edit --no-ff $RC_BRANCH
        if [ $? -ne 0 ]; then
            echo "Merge conflict occurred. Please resolve conflicts and try again."
            exit 1
        fi
    fi

    if [[ $DRY_RUN_MODE == true ]]; then
        echo "Dry running git push"
        git push --dry-run origin $PATCH_BRANCH
    else
        echo "Pushing updated release branch '$PATCH_BRANCH'"
        git push origin $MAJOR_MINOR_BRANCH
    fi
fi
