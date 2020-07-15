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

npm install --production

# Download macOS NodeJS binary, using same as pkg
curl "https://nodejs.org/dist/v8.9.4/node-v8.9.4-darwin-x64.tar.gz" | tar -xz

cd ..

# Create bundle, resolve symlinks
tar czfh docker-mac-signed-bundle.tar.gz ./docker

rm -rf ./docker
