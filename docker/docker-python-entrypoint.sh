#!/bin/bash
if [ -f "${PROJECT_PATH}/requirements.txt" ]; then
    virtualenv -p python snyk
    source snyk/bin/activate
    pip install -U -r "${PROJECT_PATH}/requirements.txt"
elif [ -f "${PROJECT_PATH}/Pipfile" ]; then
    cd "${PROJECT_PATH}"
    pipenv install Pipfile
fi

cd /$HOME/
bash docker-entrypoint.sh "$@"
