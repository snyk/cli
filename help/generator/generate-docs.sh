#!/usr/bin/env bash
set -e

IMAGE_NAME=ronn-ng

if ! docker inspect --type=image $IMAGE_NAME >/dev/null 2>&1; then
  echo "Docker image $IMAGE_NAME not found, building..."
  docker build -t $IMAGE_NAME -f ./help/generator/ronn-ng.dockerfile ./help
fi

echo "Running npx command to run help generator"
RONN_COMMAND="docker run -i ronn-ng" npx ts-node ./help/generator/generator.ts
