#!/usr/bin/env bash
set -euo pipefail

# This script automates the process of updating the `release-candidate`
# branch with changes from the default branch, generating release notes,
# and creating a pull request for review.

RC_BRANCH="release-candidate"
DEFAULT_BRANCH="main"
TMP_BRANCH=tmp/$(date +%s)-$RC_BRANCH

# Update Release Candidate branch
git checkout -b $TMP_BRANCH origin/$RC_BRANCH
git pull

# Check if release candidate is behind default branch, merge default branch into release candidate
if git rev-list --left-right --count $DEFAULT_BRANCH...$RC_BRANCH | awk '{print $1}' | grep -q '[1-9]'; then
    git merge --quiet -m "chore: merge $DEFAULT_BRANCH into $RC_BRANCH $(date)" --no-edit --no-ff $DEFAULT_BRANCH
    if [ $? -ne 0 ]; then
        echo "Merge conflict occurred. Please resolve conflicts and try again."
        exit 1
    fi
fi


echo "Generating release notes…"

# Delete existing release notes
if [ -f binary-releases/RELEASE_NOTES.md ]; then
  rm binary-releases/RELEASE_NOTES.md
fi

# Generate the release notes baseline from the commits
make binary-releases/RELEASE_NOTES.md

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

