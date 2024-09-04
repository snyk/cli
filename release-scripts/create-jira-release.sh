#!/usr/bin/env bash
set -euox pipefail

curl --fail --request POST \
  --url 'https://snyksec.atlassian.net/rest/api/3/version' \
  --user "$JIRA_USER_EMAIL:$JIRA_TOKEN" \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data "{
  \"archived\": false,
  \"description\": \"https://github.com/snyk/cli/releases/tag/v$(cat binary-releases/version)\",
  \"name\": \"$(cat binary-releases/version)\",
  \"projectId\": 11104,
  \"releaseDate\": \"$(date +%Y-%m-%d)\",
  \"released\": true
}"
