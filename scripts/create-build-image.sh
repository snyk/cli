#!/usr/bin/env bash
set -exuo pipefail
# determine script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
NOW=$(date "+%Y%m%d-%H%M%S")


pushd "$SCRIPT_DIR/.."
  NODEVERSION=$(head -1 .nvmrc | cut -f1 -d '.')
  export NODEVERSION

  BASE_IMG_NAME=$DOCKER_USERNAME/cli-build
  docker buildx build --build-arg NODEVERSION="$NODEVERSION" --platform linux/amd64 -t "$BASE_IMG_NAME":latest -f .circleci/Dockerfile .
  docker tag "$BASE_IMG_NAME":latest "$BASE_IMG_NAME":"$NOW"

  ARM64=$BASE_IMG_NAME-arm64
  docker buildx build --build-arg NODEVERSION="$NODEVERSION" --platform linux/arm64 -t "$ARM64":latest -f .circleci/Dockerfile .
  docker tag "$ARM64":latest "$ARM64:$NOW"

  docker login -u "$DOCKER_USERNAME" -p "$DOCKER_PASSWORD"

  docker push "$BASE_IMG_NAME":latest
  docker push "$BASE_IMG_NAME:$NOW"
  docker push "$ARM64":latest
  docker push "$ARM64:$NOW"
popd
