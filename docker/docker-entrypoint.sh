#!/bin/bash
>&2 echo " "
>&2 echo "  Deprecation Notice for snyk/snyk-cli images"
>&2 echo "  -------------------------------------------"
>&2 echo " "
>&2 echo "  Please note, snyk/snyk-cli Docker images are deprecated and may be removed in the future."
>&2 echo "  They remain available only to provide continuity for legacy Snyk integrations."
>&2 echo "  Snyk does not recommend their use."
>&2 echo " "
>&2 echo "  Instead, please use the https://hub.docker.com/r/snyk/snyk Docker images."
>&2 echo "  See the https://github.com/snyk/snyk-images for more details and examples."
>&2 echo " "

OUTPUT_FILE=snyk-result.json
MONITOR_OUTPUT_FILE=snyk-monitor-result.json
ERROR_FILE=snyk-error.log
HTML_FILE=snyk_report.html
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

TEST_SETTINGS=""
PROJECT_SUBDIR=""

if [ -n "${TARGET_FILE}" ]; then
  if [ ! -f "${PROJECT_PATH}/${PROJECT_FOLDER}/${TARGET_FILE}" ]; then
    exitWithMsg "\"${PROJECT_PATH}/${PROJECT_FOLDER}/${TARGET_FILE}\" does not exist" 2
  fi

  PROJECT_SUBDIR=$(dirname "${TARGET_FILE}")
  MANIFEST_NAME=$(basename "${TARGET_FILE}")
  TEST_SETTINGS="--file=${MANIFEST_NAME} "
fi

if [ -n "${ORGANIZATION}" ]; then
  TEST_SETTINGS="${TEST_SETTINGS} --org=${ORGANIZATION}"
fi

SNYK_PARAMS="${SNYK_PARAMS} ${TEST_SETTINGS}"

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

runCmdAsDockerUser "touch \"${PROJECT_PATH}/${PROJECT_FOLDER}/${HTML_FILE}\""

if [ -n "$MONITOR" ]; then
  echo "Monitoring & generating report ..."
  runCmdAsDockerUser "PATH=$PATH snyk monitor --json ${SNYK_PARAMS} ${ADDITIONAL_ENV} > ${MONITOR_OUTPUT_FILE} 2>$ERROR_FILE"
fi

runCmdAsDockerUser "cat \"${OUTPUT_FILE}\" | snyk-to-html >> \"${PROJECT_PATH}/${PROJECT_FOLDER}/${HTML_FILE}\""

if [ $RC -ne "0" ]; then
  exitWithMsg "${OUTPUT_FILE}" "$RC"
fi

cat "${OUTPUT_FILE}"

exit "$RC"
