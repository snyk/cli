#!/usr/bin/env bash
set -e

shasum -a 256 -c snyk-alpine.sha256
shasum -a 256 -c snyk-linux.sha256
shasum -a 256 -c snyk-macos.sha256
shasum -a 256 -c snyk-win.exe.sha256
shasum -a 256 -c docker-mac-signed-bundle.tar.gz.sha256
