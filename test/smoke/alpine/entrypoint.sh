#!/bin/sh

echo "install snyk with binary"
snyk_cli_dl=$(curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/snyk/snyk/releases/latest | jq --raw-output '(.assets[])? | select(.name == "snyk-alpine") | .browser_download_url')
echo "snyk_cli_dl: $snyk_cli_dl"
curl -Lo ./snyk-cli "$snyk_cli_dl"
chmod -R +x ./snyk-cli
mv ./snyk-cli /usr/local/bin/snyk
snyk --version

shellspec -f d
