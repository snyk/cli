#!/bin/bash
if [ -f "${PROJECT_PATH}/requirements.txt" ]; then
    virtualenv -p python snyk
    source snyk/bin/activate
    pip install -U -r "${PROJECT_PATH}/requirements.txt"
elif [ -f "${PROJECT_PATH}/Pipfile" ]; then
    if [ -f "${PROJECT_PATH}/Pipfile.lock" ]; then
      pushd "${PROJECT_PATH}/"
      pipenv sync
      popd
    else
      pushd "${PROJECT_PATH}/"
      pipenv update
      popd
   fi
fi

bash docker-entrypoint.sh "$@"
