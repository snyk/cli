#!/usr/bin/env bash
# POST a continuation config to the CircleCI dynamic configuration API.
set -euo pipefail

CONFIG_PATH="${1:-}"
if [ -z "$CONFIG_PATH" ] && [ -r /tmp/continuation-config-path.txt ]; then
  CONFIG_PATH="$(cat /tmp/continuation-config-path.txt)"
fi

if [ -z "$CONFIG_PATH" ] || [ ! -r "$CONFIG_PATH" ]; then
  echo "continue-pipeline: missing or unreadable config path" >&2
  exit 2
fi

if [ -z "${CIRCLE_CONTINUATION_KEY:-}" ]; then
  echo "continue-pipeline: CIRCLE_CONTINUATION_KEY is required" >&2
  exit 1
fi

mkdir -p /tmp/circleci
jq -Rs '.' "$CONFIG_PATH" > /tmp/circleci/config-string.json
jq -n \
  --arg continuation "$CIRCLE_CONTINUATION_KEY" \
  --slurpfile config /tmp/circleci/config-string.json \
  '{"continuation-key": $continuation, "configuration": $config|join("\n"), "parameters": {}}' \
  > /tmp/circleci/continue_post.json
code="$(curl -sS -o /tmp/circleci/continue_response.json -w '%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data @/tmp/circleci/continue_post.json \
  "https://${CIRCLECI_DOMAIN:-circleci.com}/api/v2/pipeline/continue")"
cat /tmp/circleci/continue_response.json
[ "$code" = "200" ]
