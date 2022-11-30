#!/usr/bin/env bash
set -euo pipefail

npm install --location=global binary-releases/snyk.tgz
snyk