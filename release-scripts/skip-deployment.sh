#!/usr/bin/env bash
set -euo pipefail
# Based on the given release channel as an argument, this script checks if the current
# branch is used for this channel.

TEST_CHANNEL=$1
ENABLE_STABLE_CHANNELS=$($(dirname "$0")/enable-stable-release-channels.sh)

# legacy release channel mapping (preview=stable)
if [ "$TEST_CHANNEL" == "preview" ] && [ "$ENABLE_STABLE_CHANNELS" == false ]; then
  TEST_CHANNEL=stable
fi

RELEASE_CHANNEL="$($(dirname "$0")/determine-release-channel.sh)"
if [ "$RELEASE_CHANNEL" == $TEST_CHANNEL ]; then
  echo false
  exit 0
fi

echo true