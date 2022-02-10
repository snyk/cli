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
)

VERSION_TAG="v$(cat binary-releases/version)"

# Upload files to the GitHub release
gh release create "${VERSION_TAG}" "${StaticFiles[@]}" \
  --title "${VERSION_TAG}" \
  --notes-file binary-releases/RELEASE_NOTES.md

# Upload files to the versioned folder
for filename in "${StaticFiles[@]}"; do
  aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/cli/"${VERSION_TAG}"/
done

# Upload files to the /latest folder
for filename in "${StaticFiles[@]}"; do
  aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/cli/latest/
done

aws s3 cp "binary-releases/release.json" s3://"${PUBLIC_S3_BUCKET}"/cli/"${VERSION_TAG}"/
aws s3 cp "binary-releases/version" s3://"${PUBLIC_S3_BUCKET}"/cli/"${VERSION_TAG}"/
aws s3 cp "binary-releases/release.json" s3://"${PUBLIC_S3_BUCKET}"/cli/latest/
aws s3 cp "binary-releases/version" s3://"${PUBLIC_S3_BUCKET}"/cli/latest/
