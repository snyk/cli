#!/usr/bin/env bash
set -euo pipefail

declare -a StaticFiles=(
  "binary-releases/snyk-alpine"
  "binary-releases/snyk-linux"
  "binary-releases/snyk-linux-arm64"
  "binary-releases/snyk-macos"
  "binary-releases/snyk-win.exe"
  "binary-releases/snyk-for-docker-desktop-darwin-x64.tar.gz"
  "binary-releases/snyk-for-docker-desktop-darwin-arm64.tar.gz"
  "binary-releases/docker-mac-signed-bundle.tar.gz"
  "binary-releases/snyk-alpine.sha256"
  "binary-releases/snyk-linux.sha256"
  "binary-releases/snyk-linux-arm64.sha256"
  "binary-releases/snyk-macos.sha256"
  "binary-releases/snyk-win.exe.sha256"
  "binary-releases/snyk-for-docker-desktop-darwin-x64.tar.gz.sha256"
  "binary-releases/snyk-for-docker-desktop-darwin-arm64.tar.gz.sha256"
  "binary-releases/docker-mac-signed-bundle.tar.gz.sha256"
  "binary-releases/sha256sums.txt.asc"
)

VERSION_TAG="v$(cat binary-releases/version)"

if [ ${#} == 0 ]; then
  echo "No upload target defined!"
  exit 1
fi

for arg in "${@}"; do
   target="${arg}"
    if [ "${arg}" == "version" ]; then
      target="${VERSION_TAG}"
    fi
    echo "Uploading to ${target}"

  # Upload files to the GitHub release
  if [ "${arg}" == "github" ]; then
    gh release create "${VERSION_TAG}" "${StaticFiles[@]}" \
      --target "${CIRCLE_SHA1}" \
      --title "${VERSION_TAG}" \
      --notes-file binary-releases/RELEASE_NOTES.md

  # Upload files to npm
  elif [ "${arg}" == "npm" ]; then
    npm publish ./binary-releases/snyk-fix.tgz
	  npm publish ./binary-releases/snyk-protect.tgz
	  npm publish ./binary-releases/snyk.tgz
  
  # Upload files to S3 bucket
  else
    for filename in "${StaticFiles[@]}"; do
      aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/cli/"${target}"/
    done

    aws s3 cp "binary-releases/release.json" s3://"${PUBLIC_S3_BUCKET}"/cli/"${target}"/
    aws s3 cp "binary-releases/version" s3://"${PUBLIC_S3_BUCKET}"/cli/"${target}"/
  fi  
done
