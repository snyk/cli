#!/usr/bin/env bash
set -euo pipefail

# This script automates the process of updating the `release-candidate`
# branch with changes from the default branch, generating release notes,
# and creating a pull request for review.

RC_BRANCH="release-candidate"
DEFAULT_BRANCH="main"
TMP_BRANCH=tmp/$(date +%s)-$RC_BRANCH

# Update Release Candidate branch
git checkout -b $TMP_BRANCH origin/$DEFAULT_BRANCH
git pull

echo "Generating release notes…"

# Delete existing release notes
if [ -f binary-releases/RELEASE_NOTES.md ]; then
  rm binary-releases/RELEASE_NOTES.md
  rm binary-releases/version
fi

# Generate the release notes baseline from the commits
make binary-releases/RELEASE_NOTES.md format

# if the release notes are generated locally, the version contains something like X.Y.Z-dev.hash
# the replacement below ensures that the version in the RELEASE_NOTES.md is X.Y.Z
VERSION_TO_REPLACE=$(npm pkg get version | tr -d '"')
VERSION_TO_REPLACE_WITH=$(npx semver --coerce $(cat binary-releases/version))
sed -i "version" -e "s/$VERSION_TO_REPLACE/$VERSION_TO_REPLACE_WITH/g" binary-releases/RELEASE_NOTES.md

# Commit and push the release notes
git add -f binary-releases/RELEASE_NOTES.md
git commit -m "docs: update release notes"

if command -v gh >/dev/null 2>&1; then
    # Use the GitHub CLI to create a pull request
    # https://cli.github.com/manual/gh_pr_create
    gh pr create --repo snyk/cli --base $RC_BRANCH --title "chore: Update release candidate" --body "Release Candidate" --draft
else
    echo "gh cli not installed, unable to create the PR automatically.\n"
    echo "Please create a PR from $TMP_BRANCH to $RC_BRANCH manually."
    git push origin $TMP_BRANCH
    exit 1
fi

echo ""
echo "#################################################################################################"
echo "# Next Steps:"
echo  "# 1. [optional] take a look at the release notes, edit and push changes if necessary. (binary-releases/RELEASE_NOTES.md)"
echo  "# 2. Mark the created PR for review and merge it as soon as approved."
echo "#################################################################################################"
