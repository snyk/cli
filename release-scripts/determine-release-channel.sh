#!/usr/bin/env bash
set -euo pipefail

# This script determines the appropriate release channel for a project based on
# the current Git branch. The script should always return a string value that
# matches one of the supported channels.
#
# The following release channels are supported:
# - stable
# - rc
# - preview
# - dev


ENABLE_STABLE_CHANNELS=$($(dirname "$0")/enable-stable-release-channels.sh)

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ $ENABLE_STABLE_CHANNELS == true ]; then # support for stable, preview and release candidate
  if [ "$CURRENT_BRANCH" == "main" ]; then
    echo "preview"
  elif [ "$CURRENT_BRANCH" == "release-candidate" ]; then
    echo "rc"
  elif [[ "$CURRENT_BRANCH" == release/* ]]; then
    echo "stable"
  else
    echo "dev"
  fi
else # legacy release channels
  if [ "$CURRENT_BRANCH" == "main" ]; then
    echo "stable"
  else
    echo "dev"
  fi
fi

