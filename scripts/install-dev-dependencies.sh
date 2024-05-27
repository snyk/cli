#!/usr/bin/env bash
set -exuo pipefail

# requires https://brew.sh/
brew bundle --file=$(dirname "$0")/Brewfile
