#!/usr/bin/env bash
set -exuo pipefail # ensures that the script exits on any error, and that all commands are printed before they are executed

# This script is used for building Docker images which in turn build the CLI.
# It sets up the environment, logs into Docker, and builds images for different architectures.

# Before running the script, ensure DOCKER_USERNAME and DOCKER_PASSWORD environment variables are set.
# Example usage:
#   export DOCKER_USERNAME=<your-docker-hub-username>
#   export DOCKER_PASSWORD=<a-docker-hub-personal-access-token>
#   ./scripts/create-build-image.sh

# Determine the directory where the script is located.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
NOW=$(date "+%Y%m%d-%H%M%S")


pushd "$SCRIPT_DIR/.."
  NODEVERSION=$(head -1 .nvmrc)
  export NODEVERSION

  docker login -u "$DOCKER_USERNAME" -p "$DOCKER_PASSWORD"

  BASE_IMG_NAME=$DOCKER_USERNAME/cli-build
  docker buildx build \
    --build-arg NODEVERSION="$NODEVERSION" \
    --build-arg ARCH="x86_64" \
    --platform linux/amd64 \
    --tag "$BASE_IMG_NAME":$NOW \
    --tag "$BASE_IMG_NAME":latest \
    --push \
    --file .circleci/Dockerfile .

  BASE_IMG_NAME=$DOCKER_USERNAME/cli-build-arm64
  docker buildx build \
    --build-arg NODEVERSION="$NODEVERSION" \
    --build-arg ARCH="aarch64" \
    --platform linux/arm64 \
    --tag "$BASE_IMG_NAME":$NOW \
    --tag "$BASE_IMG_NAME":latest \
    --push \
    --file .circleci/Dockerfile .

popd
