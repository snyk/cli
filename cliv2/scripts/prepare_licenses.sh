#!/usr/bin/env bash
set -euo pipefail
BASEDIR=$(dirname "$0")

go run $BASEDIR/prepare_licenses.go
