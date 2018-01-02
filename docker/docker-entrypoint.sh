#!/bin/bash

OUTPUT_FILE=snyk-result.json
ERROR_FILE=snyk-error.log
HTML_FILE=snyk_report.html
SNYK_COMMAND="$1"
SNYK_PARAMS="${@:2}"
ADDITIONAL_ENV=""

if [ -z "$USER_ID" ]; then
  USER_ID=$(id -u)
fi

USER_NAME=$(getent passwd "$USER_ID" | awk -F ':' '{print $1}')

if [ "$USER_NAME" != "" ] && [ "$USER_NAME" != "root" ]; then
  usermod -d /home/node "$USER_NAME"
fi

useradd -o -m -u "$USER_ID" -d /home/node docker-user 2>/dev/null

runCmdAsDockerUser () {
  su docker-user -m -c "$1"

  return $?
}

exitWithMsg () {
  echo "Failed to run the process ..."

  if [ -f "$1" ]; then
    cat "$1"
  else
    echo "$1"
  fi

  exit "$2"
}

##
## Start of backward compatability code
## Should be phased out when we phase out the current version of the jenkins plugin
## These parameters should only be used with the Jenkins plugin! Please see README.md for more info
##

TEST_SETTINGS="";
PROJECT_SUBDIR=""

if [ ! -z "$TARGET_FILE" ]; then
  if [ ! -f "$PROJECT_PATH/$PROJECT_FOLDER/$TARGET_FILE" ]; then
    exitWithMsg "$PROJECT_PATH/$PROJECT_FOLDER/$TARGET_FILE does not exist" 1
  fi

  PROJECT_SUBDIR=$(dirname "${TARGET_FILE}")
  MANIFEST_NAME=$(basename "${TARGET_FILE}")
  TEST_SETTINGS="--file=${MANIFEST_NAME} "
fi

if [ ! -z "$ORGANIZATION" ]; then
  TEST_SETTINGS="${TEST_SETTINGS} --org=${ORGANIZATION}"
fi

SNYK_PARAMS="${SNYK_PARAMS} ${TEST_SETTINGS}"

##
## End of backward compatability code
##

if [ -z "$SNYK_TOKEN" ]; then
  exitWithMsg "Missing \$SNYK_TOKEN" 1
fi

if [ ! -z "$ENV_FLAGS" ]; then
  ADDITIONAL_ENV="-- ${ENV_FLAGS}"
fi

cd "$PROJECT_PATH/$PROJECT_FOLDER/$PROJECT_SUBDIR" || exitWithMsg "Can't cd to $PROJECT_PATH/$PROJECT_FOLDER/$PROJECT_SUBDIR" 1

runCmdAsDockerUser "PATH=$PATH snyk $SNYK_COMMAND $SNYK_PARAMS $ADDITIONAL_ENV > $OUTPUT_FILE 2>$ERROR_FILE"

RC=$?

if [ "$RC" -ne "0" ] && [ "$RC" -ne "1" ]; then
  exitWithMsg "$OUTPUT_FILE" "$RC"
fi

#
# Commented out the condition because we want to always generate the html file until we phase out the old version of the Jenkins plugin
# TODO: Re-add this option to documentation once back
#
# - `GENERATE_REPORT` - [OPTIONAL] if set, this will generate the HTML report with a summary of the vulnerabilities detected by snyk.
#
# if [ ! -z $GENERATE_REPORT ]; then
runCmdAsDockerUser "touch $PROJECT_PATH/$PROJECT_FOLDER/$HTML_FILE"

if [ ! -z "$MONITOR" ]; then
  runCmdAsDockerUser "PATH=$PATH snyk monitor --json $SNYK_PARAMS -- $ADDITIONAL_ENV | jq -r \".uri\" | awk '{print \"<center><a target=\\\"_blank\\\" href=\\\"\" \$0 \"\\\">View On Snyk.io</a></center>\"}' > $PROJECT_PATH/$PROJECT_FOLDER/$HTML_FILE 2>$ERROR_FILE"
fi


runCmdAsDockerUser "cat $OUTPUT_FILE | jq '.vulnerabilities|= map(. + {severity_numeric: (if(.severity) == \"high\" then 1 else (if(.severity) == \"medium\" then 2 else (if(.severity) == \"low\" then 3 else 4 end) end) end)}) |.vulnerabilities |= sort_by(.severity_numeric) | del(.vulnerabilities[].severity_numeric)' | snyk-to-html | sed 's/<\/head>/  <link rel=\"stylesheet\" href=\"snyk_report.css\"><\/head>/' >> $PROJECT_PATH/$PROJECT_FOLDER/$HTML_FILE"
runCmdAsDockerUser "cat /home/node/snyk_report.css > $PROJECT_PATH/$PROJECT_FOLDER/snyk_report.css"
# fi
#

if [ $RC -ne "0" ]; then
  exitWithMsg "$OUTPUT_FILE" "$RC"
fi

cat "$OUTPUT_FILE"

exit "$RC"
