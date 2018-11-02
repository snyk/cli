#!/bin/bash

RUN_DIR=$(mktemp -d)

PIPENV_FILE=$PROJECT_PATH/Pipfile
REQUIREMENTS_FILE=$RUN_DIR/requirements.txt
if [ -f $PIPENV_FILE ]; then
    CURRENT_PATH=$(pwd)
    cd $PROJECT_PATH
    pipenv lock --requirements --keep-outdated > $RUN_DIR/requirements.txt
    cd $CURRENT_PATH
else
    cp $PROJECT_PATH/requirements.txt $RUN_DIR/requirements.txt
fi

virtualenv -p python$PYTHON_VERSION snyk
source snyk/bin/activate
pip install -U -r $REQUIREMENTS_FILE

PROJECT_PATH=$RUN_DIR
bash docker-entrypoint.sh "$@"