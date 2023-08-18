#!/usr/bin/env bash
set -euo pipefail

pushd binary-releases
shasum -a 256 -c sha256sums.txt.asc
gpg --import ../help/_about-this-project/snyk-code-signing-public.pgp
gpg --verify sha256sums.txt.asc
popd

pushd binary-releases/fips
shasum -a 256 -c sha256sums.txt.asc
gpg --import ../../help/_about-this-project/snyk-code-signing-public.pgp
gpg --verify sha256sums.txt.asc
popd