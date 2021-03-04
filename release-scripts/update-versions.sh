#!/usr/bin/env bash
set -e

LATEST_PACKAGE_VERSION=$(npm view snyk version)
echo "LATEST_PACKAGE_VERSION: ${LATEST_PACKAGE_VERSION}"

echo "versions before modifying:"
cat ./lerna.json ./package.json ./packages/snyk-protect/package.json ./packages/snyk-fix/package.json | grep version

if [[ $(uname -s) == "Darwin" ]];then
    echo "this is Mac"
    sed -i "" "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./lerna.json
    sed -i "" "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./package.json
    sed -i "" "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./packages/snyk-protect/package.json
    sed -i "" "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./packages/snyk-fix/package.json
else
    echo "this is Linux"
    sed -i "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./lerna.json
    sed -i "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./package.json
    sed -i "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./packages/snyk-protect/package.json
    sed -i "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./packages/snyk-fix/package.json
fi

echo "versions after modifying:"
cat ./lerna.json ./package.json ./packages/snyk-protect/package.json ./packages/snyk-fix/package.json | grep version
