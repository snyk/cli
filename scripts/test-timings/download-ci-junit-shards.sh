#!/usr/bin/env bash
# Download junit.xml from CircleCI parallel-run artifact URLs into reports-from-ci/.
#
# Usage:
#   ./scripts/test-timings/download-ci-junit-shards.sh --platform <linux|macos|windows>
#
# Reads urls-<platform>.txt from the reports-from-ci/ directory next to this
# script.  If the file doesn't exist yet it is auto-created from the matching
# .example template so you can paste fresh URLs right away.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${SCRIPT_DIR}/reports-from-ci"

PLATFORM=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 --platform <linux|macos|windows>"
      exit 1
      ;;
  esac
done

if [[ -z "${PLATFORM}" ]]; then
  echo "Usage: $0 --platform <linux|macos|windows>"
  exit 1
fi

URLS_FILE="${OUT_DIR}/urls-${PLATFORM}.txt"
SHARD_DIR="${OUT_DIR}/${PLATFORM}"
EXAMPLE_FILE="${OUT_DIR}/urls-${PLATFORM}.txt.example"

if [[ ! -f "${URLS_FILE}" ]]; then
  if [[ -f "${EXAMPLE_FILE}" ]]; then
    cp "${EXAMPLE_FILE}" "${URLS_FILE}"
    echo "Created ${URLS_FILE} from the example template."
    echo "Edit it with fresh CircleCI artifact URLs, then re-run this script."
  else
    echo "Missing ${URLS_FILE} (and no ${EXAMPLE_FILE} template found)."
    echo "Create urls-${PLATFORM}.txt with one download URL per line (shard 0 first)."
  fi
  exit 1
fi

URLS=()
while IFS= read -r line || [[ -n "${line}" ]]; do
  [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
  URLS+=("${line}")
done < "${URLS_FILE}"

if [[ ${#URLS[@]} -eq 0 ]]; then
  echo "No URLs in ${URLS_FILE}"
  exit 1
fi

shard=0
for url in "${URLS[@]}"; do
  dest="${SHARD_DIR}/shard-${shard}/junit.xml"
  mkdir -p "$(dirname "${dest}")"
  echo "Downloading shard-${shard} ..."
  if ! curl -fL --retry 2 --retry-delay 1 -o "${dest}" "${url}"; then
    echo "Failed to download shard-${shard}. Links expire quickly — grab fresh URLs from CircleCI."
    exit 1
  fi
  shard=$((shard + 1))
done

echo "Downloaded ${#URLS[@]} report(s) under ${SHARD_DIR}/"
echo "Run: npm run gen:test-timings:${PLATFORM}"
