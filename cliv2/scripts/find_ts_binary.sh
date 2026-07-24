#!/usr/bin/env bash
set -uo pipefail

# Resolves the single extracted TS binary file under a cache dir (e.g.
# $SNYK_CACHE_PATH after running a legacy-only command like `snyk woof` to
# force extraction). Prints the resolved path on success.

LOG_PREFIX="--- $(basename "$0"):"

cache_dir="${1:-}"
if [[ -z "$cache_dir" ]]; then
  echo "$LOG_PREFIX ERROR! Usage: $0 <cache-dir>" >&2
  exit 1
fi

gnu_find=find
if command -v cygpath >/dev/null 2>&1; then
  cache_dir="$(cygpath -u "$cache_dir")"
  # plain "find" can resolve to Windows' System32\find.exe (a text-search
  # tool, not GNU find) if it precedes Git's usr/bin on PATH.
  gnu_find=/usr/bin/find
fi

if [[ ! -d "$cache_dir" ]]; then
  echo "$LOG_PREFIX ERROR! Cache dir does not exist: $cache_dir" >&2
  exit 1
fi

candidates=()
while IFS= read -r candidate; do
  candidates+=("$candidate")
done < <("$gnu_find" "$cache_dir" -mindepth 2 -maxdepth 2 -type f ! -iname '*.sha256' ! -iname '*.lock')

if [[ ${#candidates[@]} -eq 0 ]]; then
  echo "$LOG_PREFIX ERROR! Could not find extracted TS binary under $cache_dir" >&2
  exit 1
elif [[ ${#candidates[@]} -gt 1 ]]; then
  echo "$LOG_PREFIX ERROR! Found more than one candidate under $cache_dir: ${candidates[*]}" >&2
  exit 1
fi

echo "${candidates[0]}"
