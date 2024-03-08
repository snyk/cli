#!/usr/bin/env bash
set -euo pipefail

# enable support for stable, preview and other release channels
ENABLE_STABLE_CHANNELS=false

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

