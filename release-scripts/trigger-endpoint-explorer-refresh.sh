#!/usr/bin/env bash

# This trigger is deliberately best-effort. The CLI release must not wait for
# the Explorer refresh or fail when the Explorer or GitHub API is unavailable.
set -u

CHANNEL="${1:-}"

case "$CHANNEL" in
  stable|preview)
    ;;
  *)
    echo "WARNING: Endpoint Explorer refresh skipped for unsupported channel '$CHANNEL'."
    exit 0
    ;;
esac

if [ -z "${HAMMERHEAD_GITHUB_PAT:-}" ]; then
  echo "WARNING: HAMMERHEAD_GITHUB_PAT is unavailable; Endpoint Explorer $CHANNEL refresh was not requested."
  exit 0
fi

HTTP_STATUS=$(curl \
  --location \
  --request POST \
  --connect-timeout 2 \
  --max-time 5 \
  --header "Accept: application/vnd.github+json" \
  --header "Authorization: Bearer $HAMMERHEAD_GITHUB_PAT" \
  --header "X-GitHub-Api-Version: 2022-11-28" \
  --data "{\"ref\":\"main\",\"inputs\":{\"channel\":\"$CHANNEL\"}}" \
  --write-out "%{http_code}" \
  --silent \
  --show-error \
  --output /dev/null \
  "https://api.github.com/repos/snyk/endpoint-binary-explorer/actions/workflows/refresh-cli-data.yml/dispatches")
CURL_STATUS=$?

if [ "$CURL_STATUS" -ne 0 ]; then
  echo "WARNING: Endpoint Explorer $CHANNEL refresh dispatch failed (curl exit $CURL_STATUS); continuing the CLI release."
elif [ "$HTTP_STATUS" != "204" ]; then
  echo "WARNING: Endpoint Explorer $CHANNEL refresh was not requested (HTTP $HTTP_STATUS); continuing the CLI release."
else
  echo "Endpoint Explorer $CHANNEL refresh requested."
fi

exit 0
