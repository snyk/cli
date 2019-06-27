#!/bin/sh

echo "Building an alpine standalone binary..."
cd snyk
# install pkg globally so that the local deps do not get polluted with it
# prevents non-deterministic tests, as they depend on the deps being used
npm i -g pkg
pkg . -t alpine -o snyk-alpine
echo "Done building an alpine standalone binary!"
