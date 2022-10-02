#!/usr/bin/env bash
set -euo pipefail

SIGNING_CERTIFICATE_FILE=Certificate.cer
SIGNING_KEY_FILE=Snyk_Limited.key

# create files as needed
echo "Creating .key file"
echo "$SIGNING_CERTIFICATE_BINARY" | base64 --decode > "$SIGNING_CERTIFICATE_FILE"

echo "Creating .cer file"
echo "$SIGNING_KEY_BINARY" | base64 --decode > "$SIGNING_KEY_FILE"

osslsigncode sign -h sha512 \
  -certs "$SIGNING_CERTIFICATE_FILE" \
  -key "$SIGNING_KEY_FILE" \
  -n "Snyk CLI" \
  -i "https://snyk.io" \
  -t "http://timestamp.comodoca.com/authenticode" \
  -in binary-releases/snyk-win-unsigned.exe \
  -out binary-releases/snyk-win.exe

rm -f "$SIGNING_CERTIFICATE_FILE"
rm -f "$SIGNING_KEY_FILE"
