#!/bin/bash

OUTPUT_FILE=snyk-result.json
ERROR_FILE=snyk-error.log
HTML_FILE=snyk_report.html
SNYK_COMMAND="$1"
SNYK_PARAMS="${@:2}"

if [ -z $USER_ID ]; then
  USER_ID=`id -u`
fi

if [ $USER_ID -ne 0 ]; then
  useradd -m -o -u $USER_ID -d /home/node docker-user 2>/dev/null
fi

runCmdAsDockerUser () {
  if [ $USER_ID -ne 0 ]; then
    su docker-user -m -c "$1; status=$?"
  else
    bash -c "$1; status=$?"
  fi

  return $status
}

exitWithMsg () {
  echo "Failed to run the process ..."

  if [ -f $1 ]; then
    cat "$1"
  else
    echo "$1"
  fi

  exit $2
}

if [ -z $SNYK_TOKEN ]; then
  exitWithMsg "Missing \$SNYK_TOKEN" 1
fi

cd "$PROJECT_PATH/$TARGET_FILE_DIR"

runCmdAsDockerUser "PATH=$PATH snyk $SNYK_COMMAND $SNYK_PARAMS --json > $OUTPUT_FILE 2>$ERROR_FILE"

RC=$?

if [ $RC -ne "0" ] && [ $RC -ne "1" ]; then
  exitWithMsg "$OUTPUT_FILE" $RC
fi

if [ ! -z $MONITOR ]; then
  runCmdAsDockerUser "PATH=$PATH snyk monitor $SNYK_PARAMS"
fi

if [ ! -z $GENERATE_REPORT ]; then
  runCmdAsDockerUser "cat $OUTPUT_FILE | jq '.vulnerabilities|= map(. + {severity_numeric: (if(.severity) == \"high\" then 1 else (if(.severity) == \"medium\" then 2 else (if(.severity) == \"low\" then 3 else 4 end) end) end)}) |.vulnerabilities |= sort_by(.severity_numeric) | del(.vulnerabilities[].severity_numeric)' | snyk-to-html | sed 's/<\/head>/  <link rel=\"stylesheet\" href=\"snyk_report.css\"><\/head>/' > $HTML_FILE"
  runCmdAsDockerUser "cat /home/node/snyk_report.css > snyk_report.css"
fi

if [ $RC -ne "0" ]; then
  exitWithMsg "$OUTPUT_FILE" $RC
fi

cat $OUTPUT_FILE

exit $RC
