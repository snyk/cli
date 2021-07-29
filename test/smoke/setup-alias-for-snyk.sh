#!/usr/bin/env bash
set -e

# Force CI to have this built Snyk version available in shell used
echo "node ${PWD}/bin/snyk \"\$@\"" > /usr/local/bin/snyk
chmod +x /usr/local/bin/snyk
