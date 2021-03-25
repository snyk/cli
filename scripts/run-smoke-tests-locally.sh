#!/usr/bin/env bash
set -e

echo "Attempting to run Smoke Tests locally. See file 'test/smoke/README.md' for details. This will drop your local 'snyk config'!"

if [ -z "$SNYK_API_TOKEN" ]; then
  echo "You need to set 'SNYK_API_TOKEN' envvar." >&2
  exit 1
fi

if ! [ -x "$(command -v shellspec)" ]; then
  if ! [ -x "$(command -v brew)" ]; then
    echo "Error: Shellspec is not installed. See https://shellspec.info for install instructions" >&2
    exit 1
  fi
  echo "Installing shellspec with brew"
  brew install shellspec
fi

if ! [ -x "$(command -v jq)" ]; then
  if ! [ -x "$(command -v brew)" ]; then
    echo "Error: jq is not installed. See https://stedolan.github.io/jq/ for install instructions" >&2
    exit 1
  fi
  echo "Installing jq with brew"
  brew install jq
fi

if ! [ -x "$(command -v timeout)" ]; then
  if ! [ -x "$(command -v brew)" ]; then
    echo "Error: 'timeout' command is not installed." >&2
    exit 1
  fi
  echo "Installing coreutils (which contains timeout) with brew"
  brew install coreutils
fi

echo "Installing fixture project with npm install"
npm install --silent --prefix test/fixtures/basic-npm

SNYK_COMMAND="node ${PWD}/dist/cli" REGRESSION_TEST=1 SMOKE_TESTS_SKIP_TEST_THAT_OPENS_BROWSER=1 SMOKE_TESTS_SNYK_TOKEN=$SNYK_API_TOKEN shellspec --chdir test/smoke test/smoke/spec/snyk_auth_spec.sh -f d
