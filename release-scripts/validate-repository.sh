#!/usr/bin/env bash
set -euo pipefail

if git describe --contains --tags; then
    echo "This commit has already been released."
    exit 1
fi
