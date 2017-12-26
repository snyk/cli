#!/bin/bash

if [ "$TRAVIS_BRANCH" = "master" ]; then 
  # manually detect master branch push, and post a dockerhub trigger to build the docker images
  curl -s -H "Content-Type: application/json" --data "{\"build\": true}" -X POST "https://registry.hub.docker.com/u/snyk/snyk-cli/trigger/${DOCKER_TOKEN}/"

  # Init codefresh builds to test the images
  curl "https://g.codefresh.io/api/builds/$GENERAL_BUILD_ID" -H "content-type:application/json; charset=utf-8"  -H "x-access-token: $CF_ACCESS_TOKEN" --data-binary "{\"repoOwner\":\"snyk\",\"repoName\":\"snyk\",\"serviceId\":\"$GENERAL_BUILD_ID\",\"branch\":\"master\",\"type\":\"build\"}" --compressed
  curl "https://g.codefresh.io/api/builds/$MAVEN352_BUILD_ID" -H "content-type:application/json; charset=utf-8"  -H "x-access-token: $CF_ACCESS_TOKEN" --data-binary "{\"repoOwner\":\"snyk\",\"repoName\":\"snyk\",\"serviceId\":\"$MAVEN352_BUILD_ID\",\"branch\":\"master\",\"type\":\"build\"}" --compressed
  curl "https://g.codefresh.io/api/builds/$GRADLE28_BUILD_ID" -H "content-type:application/json; charset=utf-8"  -H "x-access-token: $CF_ACCESS_TOKEN" --data-binary "{\"repoOwner\":\"snyk\",\"repoName\":\"snyk\",\"serviceId\":\"$GRADLE28_BUILD_ID\",\"branch\":\"master\",\"type\":\"build\"}" --compressed
  curl "https://g.codefresh.io/api/builds/$GRADLE44_BUILD_ID" -H "content-type:application/json; charset=utf-8"  -H "x-access-token: $CF_ACCESS_TOKEN" --data-binary "{\"repoOwner\":\"snyk\",\"repoName\":\"snyk\",\"serviceId\":\"$GRADLE44_BUILD_ID\",\"branch\":\"master\",\"type\":\"build\"}" --compressed
fi
