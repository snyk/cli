#!/bin/sh

set -ex

whoami
npm --version
npm install snyk -g
snyk --version
su node -c "snyk --version"
shellspec -f d
