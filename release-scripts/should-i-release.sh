#!/usr/bin/env bash

# Look at commit messages and stop the release job if it's not needed

echo "Considering these commits:"
git --no-pager log "$(git describe --tags --abbrev=0 @^)"..@ --pretty=format:'- %s %H' --no-merges

echo " "
echo "---"
echo "Checking for a feat, fix or revert commit message"

git log "$(git describe --tags --abbrev=0 @^)"..@ --pretty=format:'%s' --no-merges | grep -Ei "^(feat|fix|revert)"
if [ "$?" = "1" ]; then
  echo "No changes to release, stopping"
  circleci-agent step halt
fi
