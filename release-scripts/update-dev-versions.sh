#!/usr/bin/env bash
set -euo pipefail

DEV_PACKAGE_VERSION=$(npm view snyk version)-$(git rev-parse HEAD)
echo "DEV_PACKAGE_VERSION: ${DEV_PACKAGE_VERSION}"

if [[ $(uname -s) == "Darwin" ]];then
    echo "this is Mac"
    sed -i "" "s|1.0.0-monorepo|${DEV_PACKAGE_VERSION}|g" ./package.json
else
    echo "this is Linux"
    sed -i "s|1.0.0-monorepo|${DEV_PACKAGE_VERSION}|g" ./package.json
fi
