#!/usr/bin/env bash
set -euo pipefail

# Prints the highest stable release tag (vX.Y.Z, no pre-release suffix) by
# semver, ignoring preview/rc tags and independent of which commit they are
# reachable from (so this also works for a stable tag that only exists on an
# unmerged release/* branch).
#
# Deliberately not piped through `head -n 1`: with enough tags, head can
# close the pipe before git/grep finish writing, and under `pipefail` the
# resulting SIGPIPE surfaces as a build failure even though the correct tag
# was already produced.

stable_tags="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' || true)"

if [ -z "$stable_tags" ]; then
  echo "No stable release tags found" >&2
  exit 1
fi

echo "${stable_tags%%$'\n'*}"
