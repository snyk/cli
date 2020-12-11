#!/usr/bin/env bash
set -e

# Take built CLI
mkdir ./dist/docker
mkdir ./dist/docker/cli
cp -r ./dist/cli ./dist/docker/cli/cli
cp -r ./dist/lib ./dist/docker/cli/lib
cp ./package.json ./dist/docker/
cp ./config.default.json ./dist/docker/
cp -r ./help ./dist/docker/help

# Snyk CLI entry script
cp ./release-scripts/snyk-mac.sh ./dist/docker/

cd ./dist/docker

# All we want to do here is add the prod dependencies - not build the typescript, etc.
# Using npm 6 for this so that it won't fail due to the lack of the packages being present since all we really want
# is to install the dependencies.
npx npm@6 --yes --ignore-scripts install --production
rm -rf package-lock.json

# Download macOS NodeJS binary, using same as pkg
curl "https://nodejs.org/dist/v12.18.3/node-v12.18.3-darwin-x64.tar.gz" | tar -xz

cd ..

# Create bundle, resolve symlinks
tar czfh docker-mac-signed-bundle.tar.gz ./docker
# final package must be at root, otherwise it gets included in /dist folder
cd ..
mv ./dist/docker-mac-signed-bundle.tar.gz ./binary-releases

shasum -a 256 binary-releases/docker-mac-signed-bundle.tar.gz > binary-releases/docker-mac-signed-bundle.tar.gz.sha256

rm -rf ./dist/docker
