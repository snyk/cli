#!/usr/bin/env bash
set -ex

source /home/circleci/.sdkman/bin/sdkman-init.sh
CANDIDATE=$(sdk list java | awk '$NF ~ /^17[.]0[.].*-tem$/ { print $NF; exit }')
test -n "$CANDIDATE"
yes | sdk install java "$CANDIDATE"
sdk default java "$CANDIDATE"
yes | sdk install maven 3.6.3
yes | sdk install gradle 9.0.0
yes | sdk install scala
# sbt pin needed after Docker base image upgrade to bookworm
yes | sdk install sbt 1.12.11
