#!/bin/sh

echo "install snyk with binary"
export latest_version=$(curl -Is "https://github.com/snyk/snyk/releases/latest" | grep location | sed s#.*tag/##g | tr -d "\r")
echo "latest_version: ${latest_version}"
snyk_cli_dl_linux="https://github.com/snyk/snyk/releases/download/${latest_version}/snyk-alpine"
curl -Lo ./snyk-cli $snyk_cli_dl_linux
chmod -R +x ./snyk-cli
mv ./snyk-cli /usr/local/bin/snyk
snyk --version
export EXPECTED_SNYK_VERSION=$(snyk --version)

shellspec -f d
