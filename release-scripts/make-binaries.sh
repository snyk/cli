#!/usr/bin/env bash
set -euo pipefail

# Do not run this file locally. To build release artifacts, see CONTRIBUTING.

make prepack

make binary-releases/snyk-fix.tgz
make binary-releases/snyk-protect.tgz
make binary-releases/snyk.tgz

make binary-releases/snyk-alpine
make binary-releases/snyk-linux
make binary-releases/snyk-macos
make binary-releases/snyk-win.exe
make binary-releases/snyk-linux-arm64

make binary-releases/snyk-for-docker-desktop-darwin-x64.tar.gz
make binary-releases/snyk-for-docker-desktop-darwin-arm64.tar.gz
make binary-releases/docker-mac-signed-bundle.tar.gz
