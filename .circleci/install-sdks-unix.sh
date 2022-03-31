#!/usr/bin/env bash
# Can't set -u as sdkman has unbound variables.
set -eo pipefail

sdk install java   11.0.11.hs-adpt
sdk install maven  3.8.2
sdk install gradle 6.8.3
sdk install sbt    1.5.5
