#!/usr/bin/env bash
set -e

git clone https://github.com/openssl/openssl.git

pushd .
cd openssl
git checkout openssl-3.0.8

./Configure enable-fips
make install

popd