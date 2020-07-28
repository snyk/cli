#!/usr/bin/env bash
set -e

# Force CI to have this built Snyk version available in shell used
echo "node ${PWD}/dist/cli/index.js \"\$@\"" > /usr/local/bin/snyk
chmod +x /usr/local/bin/snyk
