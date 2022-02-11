#!/usr/bin/env bash
set -e

# default version is the minimum workable version, coming from the makefile
VERSION=$1

function print() {
  GREEN='\033[0;32m'
  NC='\033[0m'
  echo -e "${GREEN}""$1""${NC}"
}

function printError() {
  RED="\033[0;31m"
  NC='\033[0m'
  echo -e "${RED}""$1""${NC}"
}

function revertChanges(){
  git checkout go.mod go.sum ../../../../src/cli/commands/test/iac-local-execution/parsers/hcl-to-json-v2/parser.js
    printError "
      $1
      Changes in go.mod, go.sum and parser.js files have been reverted.
      "
    exit 1
}
cd src/hcltojson-v2

#search for the version in the go.mod file, && true will ignore the command if it fails
if grep -q "github.com/snyk/snyk-iac-parsers ${VERSION}" "go.mod"; then
  echo "
  Version ${VERSION} is already in use.
  Release skipped."
  exit
else
  echo "Downloading new version of the parser... ${VERSION}
  "
  go get github.com/snyk/snyk-iac-parsers@"${VERSION}" ||
  printError "Download of version ${VERSION} of the snyk-iac-parsers failed. Please check the error above for details."
  exit 1
fi

#run tests to make sure there are no breaking changes
echo "Building the new bundle...
"
cd ../..
make build >/dev/null && true
cd src/hcltojson-v2
echo "Running tests...
"

if node test.js; then
  #  tests passed, the new bundle can be copied over
  print "All tests passed."
  echo "Copying artefact to iac-local-execution directory..."
  chmod +x ./copy-artefact-to-destination.sh
  if ./copy-artefact-to-destination.sh; then
    print "Success. The new parser version can now be used."
    exit
  else
    revertChanges "Copying the artefact has failed."
  fi
else
  revertChanges "The tests have failed, please check them again. The new version of the parser might contain breaking changes."
fi
