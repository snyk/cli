#!/usr/bin/env bash
set -ex

source /home/circleci/.sdkman/bin/sdkman-init.sh
CANDIDATE=$(sdk list java | grep tem | grep 11.0. | head -1 | cut -f 6 -d "|" | xargs)
yes | sdk install java "$CANDIDATE"
yes | sdk install scala
yes | sdk install sbt
