#!/bin/bash
virtualenv -p python snyk
source snyk/bin/activate

exitWithMsg() {
    echo "Failed to run the process ..."

    if [ -f "$1" ]; then
        cat "$1"
    else
        echo "$1"
    fi

    exit "$2"
}

installRequirementsTxtDeps() {
    echo "Installing dependencies from requirements file"
    pip install -U -r "$1"
}

installPipfileDeps() {
    pushd "${PROJECT_PATH}/"
    echo "Found Pipfile"
    pipenv lock
    pipenv install --system
    popd
}

PROJECT_SUBDIR=""
echo "Project path = ${PROJECT_PATH}"
if [ -n "${TARGET_FILE}" ]; then
    if [ ! -f "${PROJECT_PATH}/${PROJECT_FOLDER}/${TARGET_FILE}" ]; then
        exitWithMsg "\"${PROJECT_PATH}/${PROJECT_FOLDER}/${TARGET_FILE}\" does not exist" 1
    fi

    PROJECT_SUBDIR=$(dirname "${TARGET_FILE}")
    MANIFEST_NAME=$(basename "${TARGET_FILE}")
    TEST_SETTINGS="--file=${MANIFEST_NAME} "

    echo "Target file = ${TARGET_FILE}"

    case $MANIFEST_NAME in
    *req*.txt)
        echo "Installing dependencies from requirements file"
        installRequirementsTxtDeps "${PROJECT_PATH}/$MANIFEST_NAME"
        ;;
    *setup.py)
        echo "Installing dependencies from setup.py"
        pip install -U -e "${PROJECT_PATH}"
        ;;
    *)
        exitWithMsg "\"${PROJECT_PATH}/${TARGET_FILE}\" is not supported" 1
        ;;
    esac
fi

if [ -f "${PROJECT_PATH}/requirements.txt" ]; then
    echo "Found requirement.txt"
    installRequirementsTxtDeps "${PROJECT_PATH}/requirements.txt"
elif [ -f "${PROJECT_PATH}/Pipfile" ]; then
    installPipfileDeps
fi

bash docker-entrypoint.sh "$@"
