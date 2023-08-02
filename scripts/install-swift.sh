#!/usr/bin/env bash
set -exuo pipefail

pushd /usr/local/
  if [[ "$1" == "x86_64" ]]; then
    FILE=swift-5.8.1-RELEASE-ubuntu20.04
    curl --compressed --output swift.tar.gz https://download.swift.org/swift-5.8.1-release/ubuntu2004/swift-5.8.1-RELEASE/$FILE.tar.gz
  fi

  if [[ "$1" == "aarch64" ]]; then
    FILE=swift-5.8.1-RELEASE-ubuntu20.04-aarch64
    curl --compressed --output swift.tar.gz https://download.swift.org/swift-5.8.1-release/ubuntu2004-"$1"/swift-5.8.1-RELEASE/$FILE.tar.gz
  fi
  tar zxf swift.tar.gz
  ln -s "$FILE" swift
  rm swift.tar.gz
popd