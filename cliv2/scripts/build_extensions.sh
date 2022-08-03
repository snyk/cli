#!/usr/bin/env bash
set -uo pipefail

echo "GOOS: ${GOOS}"
echo "GOARCH: ${GOARCH}"

cat ./bundled_extensions.json

count=$(jq -r '.extensions | length' ./bundled_extensions.json)
echo "bundled extensions count: ${count}"
echo ""

for ((i=0; i<$count; i++)); do
    repo=$(jq -r ".extensions[${i}].repo" ./bundled_extensions.json)
    echo "repo: ${repo}"

    commit_hash=$(cat ./bundled_extensions.json | jq -r ".extensions[${i}].commit_hash")
    echo "commit_hash: ${commit_hash}"

    # get the repo name from the repo url
    repo_name=$(echo ${repo} | cut -d'/' -f5)
    echo "repo_name: ${repo_name}"

    echo ""

    # Now have three vars, `repo`, `repo_name`, and `commit_hash` to use in the next step.
    git clone ${repo}
    pushd ${repo_name}
    pwd
    git checkout ${commit_hash}
    make build
    ls -la
    popd
done
