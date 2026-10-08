#!/usr/bin/env bash
set -euo pipefail

# Prints the highest stable release tag (vX.Y.Z) by semver, ignoring prerelease tags.
# Avoids `| head -n 1`, whose SIGPIPE fails the script under pipefail.

stable_tags="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' || true)"

if [ -z "$stable_tags" ]; then
  echo "No stable release tags found" >&2
  exit 1
fi

echo "${stable_tags%%$'\n'*}"
