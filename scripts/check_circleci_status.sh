#!/bin/bash

workflow_name="test_and_release"
declare -i max_retry=120
declare -i i=0
STATUS_ARR=("")
COMMIT_TO_RUN=$([[ -z ${TRAVIS_PULL_REQUEST_SHA} ]] && echo ${TRAVIS_COMMIT} || echo ${TRAVIS_PULL_REQUEST_SHA})

echo 'TRAVIS_COMMIT='${TRAVIS_COMMIT}
echo 'TRAVIS_PULL_REQUEST_SHA='${TRAVIS_PULL_REQUEST_SHA}

while [[ "${STATUS_ARR[0]}" != "completed" && "${i}" -lt "${max_retry}" ]]
do
    ((i++)) # increment attempts so if won't go forever
    curl_result=$(curl -s \
        -H 'Accept: application/vnd.github.antiope-preview+json' \
        -H 'Authorization: token '${GH_TOKEN} \
        'https://api.github.com/repos/'${TRAVIS_REPO_SLUG}'/commits/'${COMMIT_TO_RUN}'/check-runs') # query github for CircleCI job status
    result=$(echo ${curl_result} | jq -r '.check_runs[] | select(.name == "'${workflow_name}'") | "\(.status) \(.conclusion)"') # extract status and conclusion
    IFS=' ' read -ra STATUS_ARR <<< "$result"
    echo $(date '+%F %T') 'Not completed for '${COMMIT_TO_RUN}'. Finished '${i}' attempt out of '${max_retry}'. Current status: '${result}

    sleep 15
done

[[ "${STATUS_ARR[1]}" == "success" ]] && echo "Tests passed" && exit 0 || echo "Tests failed" && exit 1
