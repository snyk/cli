#!/usr/bin/env bash
set -e

LATEST_PACKAGE_VERSION=$(gh api "repos/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}/releases/latest" | jq .tag_name -r)
LATEST_PACKAGE_VERSION=${LATEST_PACKAGE_VERSION:1}
echo "LATEST_PACKAGE_VERSION: ${LATEST_PACKAGE_VERSION}"

echo "versions before modifying:"
cat ./lerna.json ./package.json ./packages/snyk-protect/package.json | grep version

if [[ $(uname -s) == "Darwin" ]];then
    echo "this is Mac"
    sed -i "" "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./lerna.json
    sed -i "" "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./package.json
    sed -i "" "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./packages/snyk-protect/package.json
else 
    echo "this is Linux"
    sed -i "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./lerna.json
    sed -i "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./package.json
    sed -i "s|1.0.0-monorepo|${LATEST_PACKAGE_VERSION}|g" ./packages/snyk-protect/package.json
fi

echo "versions after modifying:"
cat ./lerna.json ./package.json ./packages/snyk-protect/package.json | grep version
