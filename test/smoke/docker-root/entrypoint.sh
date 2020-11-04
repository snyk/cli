#!/bin/sh

set -e

echo "Install Snyk CLI with npm"
npm install snyk -g
snyk --version

export EXPECTED_SNYK_VERSION=$(snyk --version)

shellspec -f d
