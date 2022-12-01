#!/usr/bin/env bash
set -euo pipefail

releaseTar=$(pwd)/binary-releases/snyk.tgz

echo 'Creating temp directory for sandbox validation...'
pushd $(mktemp -d)

echo 'Running "npm install binary-releases/snyk.tgz"...'
npm install $releaseTar

echo 'Verifying "snyk" command succeeds...'
./node_modules/snyk/bin/snyk

popd