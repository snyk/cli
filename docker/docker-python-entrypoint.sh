#!/bin/bash

PIPENV_FILE=$PROJECT_PATH/Pipfile
REQUIREMENTS_FILE=$PROJECT_PATH/requirements.txt
if [ -f $PIPENV_FILE ]; then
    CURRENT_PATH=$(pwd)
    cd $PROJECT_PATH
    pipenv lock --requirements --keep-outdated > $REQUIREMENTS_FILE
    cd $CURRENT_PATH
fi

virtualenv -p python$PYTHON_VERSION snyk
source snyk/bin/activate
pip install -U -r $REQUIREMENTS_FILE

bash docker-entrypoint.sh "$@"

if [ -f $PIPENV_FILE ]; then
    rm -f $REQUIREMENTS_FILE
fi