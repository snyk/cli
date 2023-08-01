#!/usr/bin/env bash
set -exuo pipefail
# determine script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
NOW=$(date "+%Y%m%d-%H%M%S")


pushd "$SCRIPT_DIR/.."
  NODEVERSION=$(head -1 .nvmrc)
  export NODEVERSION

  docker login -u "$DOCKER_USERNAME" -p "$DOCKER_PASSWORD"

  BASE_IMG_NAME=$DOCKER_USERNAME/cli-build
  docker buildx build --build-arg NODEVERSION="$NODEVERSION" --build-arg ARCH="x86_64" --platform linux/amd64 -t "$BASE_IMG_NAME":latest -f .circleci/Dockerfile .
  docker tag "$BASE_IMG_NAME":latest "$BASE_IMG_NAME":"$NOW"
  docker push "$BASE_IMG_NAME":latest
  docker push "$BASE_IMG_NAME:$NOW"

  BASE_IMG_NAME=$DOCKER_USERNAME/cli-build-arm64
  docker buildx build --build-arg NODEVERSION="$NODEVERSION" --build-arg ARCH="aarch64" --platform linux/arm64 -t "$BASE_IMG_NAME":latest -f .circleci/Dockerfile .
  docker tag "$BASE_IMG_NAME":latest "$BASE_IMG_NAME":"$NOW"
  docker push "$BASE_IMG_NAME":latest
  docker push "$BASE_IMG_NAME:$NOW"
popd
