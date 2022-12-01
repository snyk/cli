#!/usr/bin/env bash
set -euo pipefail

echo 'Running "npm install"'
sudo npm install --location=global binary-releases/snyk.tgz

echo 'Running "snyk"'
snyk