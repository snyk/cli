#!/usr/bin/env bash
set -euo pipefail
BASEDIR=$(dirname "$0")
PYTHON_VERSION=""

if python3 -c 'print("python3")' > /dev/null 2>&1; then
    PYTHON_VERSION="3"
fi

PIP_BREAK_SYSTEM_PACKAGES=1 pip$PYTHON_VERSION install requests
python$PYTHON_VERSION $BASEDIR/prepare_licenses.py
