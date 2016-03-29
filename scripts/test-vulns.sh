#!/bin/bash

server=$@
snyk -v

case "$server" in
dev)
  server='https://dev.snyk.io'
  ;;
staging)
  server='https://staging.snyk.io'
  ;;
local)
  server='http://localhost:8000'
  ;;
*)
  server='https://snyk.io'
  ;;
esac

SNYK_API=$server/api snyk test @remy/snyk-shrink-test @snyk/module@1.0.0 @snyk/module express@4.x express@latest express jsbin/jsbin | tail -1