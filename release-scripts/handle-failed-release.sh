#!/usr/bin/env bash

echo "Something failed during releasing, stopping and sending alert"

curl 'https://events.pagerduty.com/v2/enqueue' \
  --data-raw "{\"payload\":{\"summary\":\"CLI release failed\",\"severity\":\"critical\",\"source\":\"CircleCI\"},
  \"routing_key\":\"${PD_ROUTING_KEY}\",\"event_action\":\"trigger\"}"
