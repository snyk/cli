#!/usr/bin/env bash
set -euo pipefail

# create files as needed
CERT_FILE=cert.pem
if [ ! -f "$CERT_FILE" ]; then
  echo "$SIGNING_CERT" | base64 --decode >"$CERT_FILE"
fi

# create files as needed
KEY_FILE=key.pem
if [ ! -f "$KEY_FILE" ]; then
  echo "$SIGNING_KEY" | base64 --decode >"$KEY_FILE"
fi

osslsigncode sign -h sha512 \
  -certs cert.pem \
  -key key.pem \
  -n "Snyk CLI" \
  -i "https://snyk.io" \
  -t "http://timestamp.comodoca.com/authenticode" \
  -in binary-releases/snyk-win-unsigned.exe \
  -out binary-releases/snyk-win.exe

rm binary-releases/snyk-win-unsigned.exe

pushd binary-releases
sha256sum snyk-win.exe >snyk-win.exe.sha256
popd
