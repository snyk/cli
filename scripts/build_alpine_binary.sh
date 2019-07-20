#!/bin/sh

# echo commands for debug purposes
set -x
# bail out in case of a single command failure
set -e

# this script is expected to run inside a node:alpine docker container
# with the path /snyk mounted with the project folder
cd /snyk
npm install # install deps in case they are missing
npm run prepare # explicit, as running as root would skip scripts

# build the binary
npm i -g pkg
pkg . -t node10-alpine-x64 -o snyk-alpine

# test it for validity
./snyk-alpine -v
