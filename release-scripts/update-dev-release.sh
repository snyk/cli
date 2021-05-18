#!/usr/bin/env bash
set -e

if [[ $(uname -s) == "Darwin" ]];then
    echo "this is Mac"
    sed -i "" "s|\"name\": \"@snyk/protect\"|\"name\": \"@snyk/protect-dev\"|g" ./packages/snyk-protect/package.json
    sed -i "" "s|\"name\": \"@snyk/fix\"|\"name\": \"@snyk/fix-dev\"|g" ./packages/snyk-fix/package.json
    sed -i "" "s|\"name\": \"snyk\"|\"name\": \"@snyk/snyk-dev\"|g" ./package.json
    sed -i "" "s|@snyk/fix|@snyk/fix-dev|g" ./package.json
else
    echo "this is Linux"
    sed -i "s|\"name\": \"@snyk/protect\"|\"name\": \"@snyk/protect-dev\"|g" ./packages/snyk-protect/package.json
    sed -i "s|\"name\": \"@snyk/fix\"|\"name\": \"@snyk/fix-dev\"|g" ./packages/snyk-fix/package.json
    sed -i "s|\"name\": \"snyk\"|\"name\": \"@snyk/snyk-dev\"|g" ./package.json
    sed -i "s|@snyk/fix|@snyk/fix-dev|g" ./package.json
fi
