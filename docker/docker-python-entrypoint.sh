#!/bin/bash

virtualenv -p python snyk
source snyk/bin/activate
pip install -U -r $PROJECT_PATH/requirements.txt
bash docker-entrypoint.sh "$@"