#!/usr/bin/env bash
set -euo pipefail

echo "Running gofmt"

# gofmt does not fail if issues are found so check if unformatted files are listed
GOFMT_RESULT="$(gofmt -l -e .)"
if test -n "${GOFMT_RESULT}"; then
  echo "${GOFMT_RESULT}"
  echo "Formatting issues found. Run 'make format' to fix them.";
  exit 1;
fi
echo "No formatting issues found."
