#!/bin/bash

virtualenv -p python snyk
source snyk/bin/activate
if [ -f "${PROJECT_PATH}/requirements.txt" ]; then
    pip install -U -r "${PROJECT_PATH}/requirements.txt"
elif [ -f "${PROJECT_PATH}/setup.py" ]; then
    pip install -U "${PROJECT_PATH}"
fi
bash docker-entrypoint.sh "$@"
