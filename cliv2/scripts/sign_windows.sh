#!/usr/bin/env bash
set -euo pipefail

# expected environment variables
#SIGNING_SECRETS_BINARY=EEE....
#SIGNING_SECRETS_PASSWORD=FFF

EXPORT_PATH=${1:-./bin}
PRODUCT_NAME=${2:-snyk_windows_amd64.exe}
APP_PATH="$EXPORT_PATH/$PRODUCT_NAME"
APP_PATH_UNSIGNED="$APP_PATH.unsigned"
SIGNING_SECRETS=secrets.p12

LOG_PREFIX="--- $(basename "$0"):"
echo "$LOG_PREFIX Signing \"$APP_PATH\""

# create files as needed
echo "$LOG_PREFIX Creating p12 file"
echo "$SIGNING_SECRETS_BINARY" | base64 --decode > "$SIGNING_SECRETS"

echo "$LOG_PREFIX Signing binary $APP_PATH_UNSIGNED"
mv "$APP_PATH" "$APP_PATH_UNSIGNED"

osslsigncode sign -h sha512 \
  -pkcs12 "$SIGNING_SECRETS" \
  -pass "$SIGNING_SECRETS_PASSWORD" \
  -n "Snyk CLI" \
  -i "https://snyk.io" \
  -t "http://timestamp.sectigo.com" \
  -in "$APP_PATH_UNSIGNED" \
  -out "$APP_PATH"

echo "$LOG_PREFIX Cleaning up"
rm -f "$APP_PATH_UNSIGNED"
rm -f "$SIGNING_SECRETS"
