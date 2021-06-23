#!/usr/bin/env bash
set -e

# This script checks the currently installed version of npm and if it is less than 7, 
# then it calls `npx npm@7 --yes --ignore-scripts install` to install using npm 7 which 
# supports workspaces.
# This script is trigged by the `prepare` lifecycle script (in the root package.json) which 
# runs after `npm install` completes. # We use `--ignore-scripts` to prevent recursively 
# calling of `prepare` after the npm@7 install.

npm_version=$(npm --version)
echo "npm version is: ${npm_version}"
npm_major_version="$(cut -d '.' -f 1 <<< "${npm_version}")"

if (( npm_major_version < 7 )); then
  echo "using npm version less than 7... "
  npx npm@7 --yes --ignore-scripts install
fi
