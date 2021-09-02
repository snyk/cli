#!/bin/bash

OUTPUT_FILE=snyk-result.json
ERROR_FILE=snyk-error.log
SNYK_COMMAND="$1"
SNYK_PARAMS="${@:2}"
ADDITIONAL_ENV=""

if [ -z "${USER_ID}" ]; then
  USER_ID=$(id -u)
fi

USER_NAME=$(getent passwd "${USER_ID}" | awk -F ':' '{print $1}')

if [ "${USER_NAME}" != "" ] && [ "${USER_NAME}" != "root" ]; then
  usermod -d /home/node "${USER_NAME}"
fi

useradd -o -m -u "${USER_ID}" -d /home/node docker-user 2>/dev/null

runCmdAsDockerUser() {
  su docker-user -m -c "$1"

  return $?
}

exitWithMsg() {
  echo "Failed to run the process ..."

  if [ -f "$1" ]; then
    cat "$1"
  else
    echo "$1"
  fi

  exit "$2"
}

if [ -z "${SNYK_TOKEN}" ]; then
  exitWithMsg "Missing \${SNYK_TOKEN}" 2
fi

if [ -n "${ENV_FLAGS}" ]; then
  ADDITIONAL_ENV="-- ${ENV_FLAGS}"
fi

cd "${PROJECT_PATH}/${PROJECT_FOLDER}/${PROJECT_SUBDIR}" ||
  exitWithMsg "Can't cd to ${PROJECT_PATH}/${PROJECT_FOLDER}/${PROJECT_SUBDIR}" 2

runCmdAsDockerUser "PATH=${PATH} snyk ${SNYK_COMMAND} --json ${SNYK_PARAMS} \
${ADDITIONAL_ENV} > \"${OUTPUT_FILE}\" 2>\"${ERROR_FILE}\""

RC=$?

if [ "$RC" -ne "0" ] && [ "$RC" -ne "1" ]; then
  exitWithMsg "${OUTPUT_FILE}" "$RC"
fi
