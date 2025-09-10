#!/usr/bin/env bash
set -euo pipefail

cat binary-releases/*.sha256 > binary-releases/sha256sums.txt
cat binary-releases/fips/*.sha256 > binary-releases/fips/sha256sums.txt
cat binary-releases/experimental/*.sha256 > binary-releases/experimental/sha256sums.txt

echo "Importing PGP key"
echo "${SNYK_CODE_SIGNING_PGP_PRIVATE}" \
    | base64 --decode \
    | gpg --import --batch --passphrase "${SNYK_CODE_SIGNING_GPG_PASSPHRASE}"

echo "Signing shasums file"
gpg \
    --clear-sign \
    --default-key="${SNYK_CODE_SIGNING_PGP_KEY_ID}" \
    --passphrase="${SNYK_CODE_SIGNING_GPG_PASSPHRASE}" \
    --pinentry-mode=loopback \
    --armor \
    --batch binary-releases/sha256sums.txt

gpg \
    --clear-sign \
    --default-key="${SNYK_CODE_SIGNING_PGP_KEY_ID}" \
    --passphrase="${SNYK_CODE_SIGNING_GPG_PASSPHRASE}" \
    --pinentry-mode=loopback \
    --armor \
    --batch binary-releases/fips/sha256sums.txt

gpg \
    --clear-sign \
    --default-key="${SNYK_CODE_SIGNING_PGP_KEY_ID}" \
    --passphrase="${SNYK_CODE_SIGNING_GPG_PASSPHRASE}" \
    --pinentry-mode=loopback \
    --armor \
    --batch binary-releases/experimental/sha256sums.txt

cat binary-releases/sha256sums.txt.asc
cat binary-releases/fips/sha256sums.txt.asc
cat binary-releases/experimental/sha256sums.txt.asc
