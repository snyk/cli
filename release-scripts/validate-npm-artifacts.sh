#!/usr/bin/env bash
set -euo pipefail

echo 'Running "npm install binary-releases/snyk.tgz"'
npm install ./binary-releases/snyk.tgz

echo 'Running "snyk"'
./node_modules/snyk/bin/snyk