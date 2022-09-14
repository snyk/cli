#!/usr/bin/env bash
set -euo pipefail

function manualLicenseDownload
{
    mkdir -p "./internal/embedded/_data/licenses/$2"
    curl -L --progress-bar --fail "$1" > "./internal/embedded/_data/licenses/$2/LICENSE"
}

# try to find all licenses via the go.mod file
export GOBIN=$(pwd)/_cache
go install github.com/google/go-licenses@latest
PATH="$PATH:$GOBIN" go-licenses save ./... --save_path=./internal/embedded/_data/licenses --force --ignore github.com/snyk/cli/cliv2/

manualLicenseDownload "https://raw.githubusercontent.com/davecgh/go-spew/master/LICENSE" github.com/davecgh/go-spew
manualLicenseDownload "https://raw.githubusercontent.com/alexbrainman/sspi/master/LICENSE" github.com/alexbrainman/sspi
manualLicenseDownload "https://raw.githubusercontent.com/pmezard/go-difflib/master/LICENSE" github.com/pmezard/go-difflib
manualLicenseDownload "https://raw.githubusercontent.com/go-yaml/yaml/v2.4.0/LICENSE" gopkg.in/yaml.v2
manualLicenseDownload "https://go.dev/LICENSE?m=text" go.dev

# clean up and print result
pushd . > /dev/null
cd ./internal/embedded/_data/licenses
find . -type f -name '*.*' -delete
find . -type f -name '*' -exec echo "    {}" \;
popd > /dev/null
