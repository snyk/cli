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
    pipenv install --system --deploy
    popd
}

echo "Project path = ${PROJECT_PATH}"
if [ -n "${TARGET_FILE}" ]; then
    if [ ! -f "${PROJECT_PATH}/${PROJECT_FOLDER}/${TARGET_FILE}" ]; then
        exitWithMsg "\"${PROJECT_PATH}/${PROJECT_FOLDER}/${TARGET_FILE}\" does not exist" 2
    fi

    MANIFEST_NAME=$(basename "${TARGET_FILE}")

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
    *Pipfile)
        echo "Installing dependencies from Pipfile"
        installPipfileDeps
        ;;
    *)
        exitWithMsg "\"${PROJECT_PATH}/${TARGET_FILE}\" is not supported" 3
        ;;
    esac
fi

if [ -z "${TARGET_FILE}" ]; then
    if [ -f "${PROJECT_PATH}/requirements.txt" ]; then
        echo "Found requirement.txt"
        installRequirementsTxtDeps "${PROJECT_PATH}/requirements.txt"
    elif [ -f "${PROJECT_PATH}/setup.py" ]; then
        echo "Found setup.py"
        pip install -U -e "${PROJECT_PATH}"
    elif [ -f "${PROJECT_PATH}/Pipfile" ]; then
        echo "Found Pipfile"
        installPipfileDeps
    fi
fi

bash docker-entrypoint.sh "$@"
