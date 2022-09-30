#!/usr/bin/env bash
set -euo pipefail

# expected environment variables
#SIGNING_SECRETS_BINARY=EEE....
#SIGNING_SECRETS_PASSWORD=FFF

EXPORT_PATH=${1:-./bin}
PRODUCT_NAME=${2:-snyk_windows_amd64.exe}
APP_PATH="$EXPORT_PATH/$PRODUCT_NAME"
APP_PATH_UNSIGNED="$APP_PATH.unsigned"
SIGNING_CERTIFICATE_FILE=Certificate.cer
SIGNING_KEY_FILE=Snyk_Limited.key

LOG_PREFIX="--- $(basename "$0"):"
echo "$LOG_PREFIX Signing \"$APP_PATH\""

# create files as needed
echo "$LOG_PREFIX Creating .key file"
echo "$SIGNING_CERTIFICATE_BINARY" | base64 --decode > "$SIGNING_CERTIFICATE_FILE"

echo "$LOG_PREFIX Creating .cer file"
echo "$SIGNING_KEY_BINARY" | base64 --decode > "$SIGNING_KEY_FILE"

echo "$LOG_PREFIX Signing binary $APP_PATH_UNSIGNED"
mv "$APP_PATH" "$APP_PATH_UNSIGNED"

osslsigncode sign -h sha512 \
  -certs "$SIGNING_CERTIFICATE_FILE" \
  -key "$SIGNING_KEY_FILE" \
  -n "Snyk CLI" \
  -i "https://snyk.io" \
  -t "http://timestamp.comodoca.com/authenticode" \
  -in "$APP_PATH_UNSIGNED" \
  -out "$APP_PATH"

echo "$LOG_PREFIX Cleaning up"
rm -f "$APP_PATH_UNSIGNED"
rm -f "$SIGNING_CERTIFICATE_FILE"
rm -f "$SIGNING_KEY_FILE"
