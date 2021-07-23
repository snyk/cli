#!/bin/sh

curl -Lo ./snyk-cli 'https://static.snyk.io/cli/latest/snyk-alpine'
chmod -R +x ./snyk-cli
mv ./snyk-cli /usr/local/bin/snyk
snyk --version

shellspec -f d
