#!/usr/bin/env bash
set -euo pipefail

declare -a StaticFiles=(
  "binary-releases/snyk-alpine"
  "binary-releases/snyk-linux"
  "binary-releases/snyk-macos"
  "binary-releases/snyk-win.exe"
  "binary-releases/docker-mac-signed-bundle.tar.gz"
  "binary-releases/snyk-alpine.sha256"
  "binary-releases/snyk-linux.sha256"
  "binary-releases/snyk-macos.sha256"
  "binary-releases/snyk-win.exe.sha256"
  "binary-releases/docker-mac-signed-bundle.tar.gz.sha256"
)

latest_version=$(cat lerna.json | jq .version -r)
new_tag="v${latest_version}"

# Upload files to the GitHub release
gh release create ${new_tag} ${StaticFiles[@]} \
  --title "${new_tag}" \
  --notes-file RELEASE_NOTES.txt

# Upload files to the versioned folder
for filename in "${StaticFiles[@]}"; do
  aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/cli/"${new_tag}"/
done

# Upload files to the /latest folder
for filename in "${StaticFiles[@]}"; do
  aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/cli/latest/
done
