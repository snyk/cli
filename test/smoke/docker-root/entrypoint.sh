#!/bin/sh

set -e

echo "Install Snyk CLI with npm"
npm install snyk -g
snyk --version

shellspec -f d
