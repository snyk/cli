#!/usr/bin/env bash
# Compares collected Snyk version artifacts for stable/preview consistency.
# Required env: SNYK_VERSION_DIR

if [[ -n "${CI:-}" ]]; then
  set -euo pipefail
else
  set -exuo pipefail
fi

: "${SNYK_VERSION_DIR:?SNYK_VERSION_DIR is required}"

if [[ "${SNYK_VERSION_DIR}" != /* ]]; then
  SNYK_VERSION_DIR="${GITHUB_WORKSPACE:-$(pwd)}/${SNYK_VERSION_DIR}"
fi

mkdir -p "${SNYK_VERSION_DIR}"

cd "${SNYK_VERSION_DIR}"

txt_files=$(ls *.txt 2>/dev/null || true)
if [ -z "$txt_files" ]; then
  echo "❌ No .txt files found in ${SNYK_VERSION_DIR}. Version comparison cannot proceed."
  exit 2
fi

echo "Collected Snyk versions:"

stable_versions=()
preview_versions=()

# First, sort the *.txt files containg versions numbers into a preview and stable array
for file in *.txt; do
  job_name=$(basename "$file" .txt)
  version=$(cat "$file" | tr -d '\r\n')
  echo "$job_name: $version"

  # Fail fast if any of the files are empty
  if [ -z "$version" ]; then
    echo "❌ File $file is does not contain anything. All .txt files must contain a version number."
    exit 3
  fi

  # Fill the stable and preview arrays
  if [[ "$file" == *"-preview"* ]]; then
    preview_versions+=("$version")
  else
    stable_versions+=("$version")
  fi
done

# Check stable versions consistency
found_diff_stable=0
if ((${#stable_versions[@]} > 0)); then
  first_stable="${stable_versions[0]}"
  echo "Checking stable versions consistency..."
  for version in "${stable_versions[@]}"; do
    if [ "$version" != "$first_stable" ]; then
      found_diff_stable=1
      echo "  ❌ Found different stable version: $version (expected: $first_stable)"
    fi
  done
fi

# Check preview versions consistency
found_diff_preview=0
if ((${#preview_versions[@]} > 0)); then
  first_preview="${preview_versions[0]}"
  echo "Checking preview versions consistency..."
  for version in "${preview_versions[@]}"; do
    if [ "$version" != "$first_preview" ]; then
      found_diff_preview=1
      echo "  ❌ Found different preview version: $version (expected: $first_preview)"
    fi
  done
fi

if [ "$found_diff_stable" -eq 1 ] || [ "$found_diff_preview" -eq 1 ]; then
  echo "❌ Snyk versions are NOT consistent across jobs."
  exit 1
fi

echo "✅ All Snyk versions (stable and preview) are consistent within their respective channels."
