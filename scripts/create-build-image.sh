#!/usr/bin/env bash

if [[ -n "${CI:-}" ]]; then
  # In CI: don't echo every command to reduce noise
  set -euo pipefail
else
  # Local development: echo all commands for debugging
  set -exuo pipefail
fi

trap 'docker logout' EXIT

# This script is used for building Docker images which in turn build the CLI.
# It sets up the environment, logs into Docker, and builds images for different architectures.

# Before running the script, ensure DOCKER_REPO, DOCKER_USERNAME and DOCKER_PASSWORD environment variables are set.
# Example usage:
#   export DOCKER_REPO=<your-docker-hub-repo> # optional, defaults to DOCKER_USERNAME if not set
#   export DOCKER_USERNAME=<your-docker-hub-username>
#   export DOCKER_PASSWORD=<a-docker-hub-personal-access-token>
#   ./scripts/create-build-image.sh <arch> (amd64 or arm64)

TARGET_ARCH="$1"
TAG="$2"

if [[ -z "$TARGET_ARCH" || -z "$TAG" ]]; then
  echo "Error: Both target architecture and tag must be provided"
  echo "Usage: $0 <target_arch> <tag>"
  echo "Examples:"
  echo "  $0 amd64 20250909-130344"
  echo "  $0 arm64 20250909-130344"
  exit 1
fi

# Determine the directory where the script is located.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

pushd "$SCRIPT_DIR/.."
  NODEVERSION=$(head -1 .nvmrc)
  export NODEVERSION

  echo "Building Docker image for $TARGET_ARCH with Node version: $NODEVERSION"
  echo "Timestamp: $TAG"

  echo "Logging into Docker"
  echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

  echo "Building $TARGET_ARCH image..."

  # Determine image name suffix and docker arch based on target arch
  if [[ "$TARGET_ARCH" == "arm64" ]]; then
    BASE_IMG_NAME=${DOCKER_REPO:-${DOCKER_USERNAME}}/cli-build-private-arm64
    DOCKER_ARCH="aarch64"
  else
    BASE_IMG_NAME=${DOCKER_REPO:-${DOCKER_USERNAME}}/cli-build-private
    DOCKER_ARCH="x86_64"
  fi

  docker buildx build \
    ${CI:+--quiet} \
    --build-arg NODEVERSION="$NODEVERSION" \
    --build-arg ARCH="$DOCKER_ARCH" \
    --platform linux/"$TARGET_ARCH" \
    --tag "$BASE_IMG_NAME":"$TAG" \
    --tag "$BASE_IMG_NAME":latest \
    --push \
    --file .circleci/Dockerfile .
  echo "Done building $TARGET_ARCH image"

popd
