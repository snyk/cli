#!/usr/bin/env bash
set -euo pipefail

VENV_DIR="./venv"

BASEDIR=$(dirname "$0")

# check to see if virtualenv is installed
command -v virtualenv >/dev/null 2>&1
VIRTUALENV_INSTALLED=$?

# if virtualenv is installed use that to isolate the python environment
if [ $VIRTUALENV_INSTALLED -eq 0 ]; then
    # Create a new virtualenv if one doesn't exists
    if [ ! -d "$VENV_DIR" ]; then
        python -m venv $VENV_DIR
    fi
    source $VENV_DIR/bin/activate
    pip install requests
    python $BASEDIR/prepare_licenses.py
    deactivate
else
    # Fall back to use a local python installation
    PYTHON_VERSION=""
    if python3 -c 'print("python3")' > /dev/null 2>&1; then
        PYTHON_VERSION="3"
    fi
    PIP_BREAK_SYSTEM_PACKAGES=1 pip$PYTHON_VERSION install requests
    python$PYTHON_VERSION $BASEDIR/prepare_licenses.py
fi
