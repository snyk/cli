#!/usr/bin/env bash
set -exuo pipefail

# requires https://brew.sh/
brew bundle --file=$(dirname "$0")/Brewfile

# create python venv and activate it
python3 -m venv .venv
source .venv/bin/activate

# install dependencies
pip install requests
pip install pyyaml