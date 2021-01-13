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

installPipInstallable() {
    echo "Installing dependencies using pip"
    pip install -U -e "${PROJECT_PATH}"
}

lockPipfileDeps() {
    pushd "${PROJECT_PATH}/"
    echo "Generating a new Pipfile.lock"
    pipenv lock
    popd
}

installPipfileDeps() {
    pushd "${PROJECT_PATH}/"
    echo "Installing dependencies from Pipfile.lock"
    pipenv sync --system
    popd
}

echo "Project path = ${PROJECT_PATH}"
PROJECT_SUBDIR=""

if [ -z "${TARGET_FILE}" ]; then
    echo "No target file specified; will attempt to discover."
    if [ -f "${PROJECT_PATH}/requirements.txt" ]; then
        echo "Found requirements.txt"
        TARGET_FILE="requirements.txt"
    elif [ -f "${PROJECT_PATH}/setup.py" ]; then
        echo "Found setup.py"
        TARGET_FILE="setup.py"
    elif [ -f "${PROJECT_PATH}/Pipfile.lock" ]; then
        echo "Found Pipfile.lock"
        TARGET_FILE="Pipfile.lock"
    elif [ -f "${PROJECT_PATH}/Pipfile" ]; then
        echo "Found Pipfile"
        TARGET_FILE="Pipfile"
    else
        echo "No target file could be discovered."
    fi
fi


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
        installRequirementsTxtDeps "${PROJECT_PATH}/$MANIFEST_NAME"
        ;;
    setup.py)
        installPipInstallable
        ;;
    Pipfile.lock)
        installPipfileDeps
        # switch back to the Pipfile mode for launching snyk-cli
        TARGET_FILE="Pipfile"
        ;;
    Pipfile)
        lockPipfileDeps
        installPipfileDeps
        ;;
    *)
        exitWithMsg "\"${PROJECT_PATH}/${TARGET_FILE}\" is not supported" 1
        ;;
    esac
fi


bash docker-entrypoint.sh "$@"
