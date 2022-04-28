#!/usr/bin/env bash
set -euo pipefail

pushd binary-releases
shasum -a 256 -c snyk-alpine.sha256
shasum -a 256 -c snyk-linux.sha256
shasum -a 256 -c snyk-linux-arm64.sha256
shasum -a 256 -c snyk-macos.sha256
shasum -a 256 -c snyk-win.exe.sha256
shasum -a 256 -c snyk-for-docker-desktop-darwin-x64.tar.gz.sha256
shasum -a 256 -c snyk-for-docker-desktop-darwin-arm64.tar.gz.sha256
shasum -a 256 -c docker-mac-signed-bundle.tar.gz.sha256
shasum -a 256 -c snyk-fix.tgz.sha256
shasum -a 256 -c snyk-protect.tgz.sha256
shasum -a 256 -c snyk.tgz.sha256
gpg --import ../help/_about-this-project/snyk-code-signing-public.pgp
gpg --verify sha256sums.txt.asc
popd
