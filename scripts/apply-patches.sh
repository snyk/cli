#!/usr/bin/env bash
set -e

echo "Applying patches from vendor directory"

for filename in ./vendor/*.patch; do
    if ! git apply --reverse --check --quiet "$filename"; then
        echo "Applying $filename"
        git apply "$filename"
    fi;
done
