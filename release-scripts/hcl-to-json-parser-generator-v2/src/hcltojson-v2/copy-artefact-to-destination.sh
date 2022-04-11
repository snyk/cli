#!/bin/bash
IAC_LOCAL_EXEC_DEST=../../../../src/cli/commands/test/iac/local-execution/parsers/hcl-to-json-v2/parser.js

if cp ./dist/hcltojson-v2.js ${IAC_LOCAL_EXEC_DEST} >/dev/null; then
#  exclude the parser.js file from linting
  (echo "/* eslint-disable */" && cat ${IAC_LOCAL_EXEC_DEST}) > filename1 && mv filename1 ${IAC_LOCAL_EXEC_DEST}
  echo "The new parser.js was successfully copied over to the iac/local-execution/parsers/hcl-to-json/ directory."
else
  echo "Copy failed."
  exit 1
fi
