#!/bin/bash

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

##
## Start of backward compatability code.
## Should be phased out when we phase out the current version of the jenkins
## plugin.
## These parameters should only be used with the Jenkins plugin! Please see
## README.md for more info.
##

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

##
## End of backward compatability code
##

if [ -z "${SNYK_TOKEN}" ]; then
  exitWithMsg "Missing \${SNYK_TOKEN}" 2
fi

if [ -n "${ENV_FLAGS}" ]; then
  ADDITIONAL_ENV="-- ${ENV_FLAGS}"
fi

cd "${PROJECT_PATH}/${PROJECT_FOLDER}/${PROJECT_SUBDIR}" ||
  exitWithMsg "Can't cd to ${PROJECT_PATH}/${PROJECT_FOLDER}/${PROJECT_SUBDIR}" 2

# If --json-file-output argument exists,
# override default output filename, unless it's empty
# if argument has empty value - exit the process
for i in "$@"; do
    if [[ "$i" == --json-file-output=* ]]; then
      JSON_FILE_KEY_VALUE=(${i//=/ })
      JSON_FILE_VALUE=${JSON_FILE_KEY_VALUE[1]}

      if [[ -z "${JSON_FILE_VALUE}" ]]; then
        exitWithMsg "Empty --json-file-output argument. Did you mean --file=path/to/output-file.json ?" 2
      fi

      OUTPUT_FILE=${JSON_FILE_VALUE}
    fi
done

runCmdAsDockerUser "PATH=${PATH} snyk ${SNYK_COMMAND} --json ${SNYK_PARAMS} \
${ADDITIONAL_ENV} > \"${OUTPUT_FILE}\" 2>\"${ERROR_FILE}\""

RC=$?

if [ "$RC" -ne "0" ] && [ "$RC" -ne "1" ]; then
  exitWithMsg "${OUTPUT_FILE}" "$RC"
fi

#
# Commented out the condition because we want to always generate the html
# file until we phase out the old version of the Jenkins plugin.
# TODO: Re-add this option to documentation once back
#
# - `GENERATE_REPORT` - [OPTIONAL] if set, this will generate the HTML report
# with a summary of the vulnerabilities detected by snyk.
#
# if [ -n $GENERATE_REPORT ]; then
runCmdAsDockerUser "touch \"${PROJECT_PATH}/${PROJECT_FOLDER}/${HTML_FILE}\""

if [ -n "$MONITOR" ]; then
  echo "Monitoring & generating report ..."
  runCmdAsDockerUser "PATH=$PATH snyk monitor --json ${SNYK_PARAMS} ${ADDITIONAL_ENV} > ${MONITOR_OUTPUT_FILE} 2>$ERROR_FILE"
  runCmdAsDockerUser "cat ${MONITOR_OUTPUT_FILE} | jq -r 'if type==\"array\" then .[].uri? else .uri? end' | awk '{print \"<center><a target=\\\"_blank\\\" href=\\\"\" \$0 \"\\\">View On Snyk.io</a></center>\"}' > \"${PROJECT_PATH}/${PROJECT_FOLDER}/${HTML_FILE}\" 2>>\"${ERROR_FILE}\""
fi


runCmdAsDockerUser "cat \"${OUTPUT_FILE}\" | \
jq 'def sortBySeverity: .vulnerabilities|= map(. + {severity_numeric: (if(.severity) == \"high\" then 1 else (if(.severity) == \"medium\" then 2 else (if(.severity) == \"low\" then 3 else 4 end) end) end)}) |.vulnerabilities |= sort_by(.severity_numeric) | del(.vulnerabilities[].severity_numeric); if (. | type) == \"array\" then map(sortBySeverity) else sortBySeverity end'| \
snyk-to-html | \
sed 's/<\/head>/  <link rel=\"stylesheet\" href=\"snyk_report.css\"><\/head>/' \
>> \"${PROJECT_PATH}/${PROJECT_FOLDER}/${HTML_FILE}\""

runCmdAsDockerUser "cat /home/node/snyk_report.css > \
\"${PROJECT_PATH}/${PROJECT_FOLDER}/snyk_report.css\""

# Replicating logic in lines 104-106
if [ $RC -ne "0" ] && [ $RC -ne "1" ]; then
  exitWithMsg "${OUTPUT_FILE}" "$RC"
fi

cat "${OUTPUT_FILE}"

exit "$RC"
