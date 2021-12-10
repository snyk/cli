#!/usr/bin/env bash
set -euo pipefail

declare -a StaticFiles=(
  "binary-releases/snyk-alpine"
  "binary-releases/snyk-linux"
  "binary-releases/snyk-macos"
  "binary-releases/snyk-win.exe"
  "binary-releases/snyk-for-docker-desktop-darwin-x64.tar.gz"
  "binary-releases/snyk-for-docker-desktop-darwin-arm64.tar.gz"
  "binary-releases/docker-mac-signed-bundle.tar.gz"
  "binary-releases/snyk-alpine.sha256"
  "binary-releases/snyk-linux.sha256"
  "binary-releases/snyk-macos.sha256"
  "binary-releases/snyk-win.exe.sha256"
  "binary-releases/snyk-for-docker-desktop-darwin-x64.tar.gz.sha256"
  "binary-releases/snyk-for-docker-desktop-darwin-arm64.tar.gz.sha256"
  "binary-releases/docker-mac-signed-bundle.tar.gz.sha256"
)

latest_version=$(cat lerna.json | jq .version -r)
new_tag="v${latest_version}"

# We need to update versions and sha256 in version.json here
if [[ $(uname -s) == "Darwin" ]];then
  echo "this is Mac"
  sed -i "" "s|1.0.0-monorepo|${latest_version}|g" ./release-scripts/release.json
  sed -i "" "s|snyk-alpine-sha256|$(cat binary-releases/snyk-alpine.sha256)|" ./release-scripts/release.json
  sed -i "" "s|snyk-linux-sha256|$(cat binary-releases/snyk-linux.sha256)|" ./release-scripts/release.json
  sed -i "" "s|snyk-macos-sha256|$(cat binary-releases/snyk-macos.sha256)|" ./release-scripts/release.json
  sed -i "" "s|snyk-win.exe-sha256|$(cat binary-releases/snyk-win.exe.sha256)|" ./release-scripts/release.json
else
  echo "this is Linux"
  sed -i "s|1.0.0-monorepo|${latest_version}|g" ./release-scripts/release.json
  sed -i "s|snyk-alpine-sha256|$(cat binary-releases/snyk-alpine.sha256)|" ./release-scripts/release.json
  sed -i "s|snyk-linux-sha256|$(cat binary-releases/snyk-linux.sha256)|" ./release-scripts/release.json
  sed -i "s|snyk-macos-sha256|$(cat binary-releases/snyk-macos.sha256)|" ./release-scripts/release.json
  sed -i "s|snyk-win.exe-sha256|$(cat binary-releases/snyk-win.exe.sha256)|" ./release-scripts/release.json
fi

# sanity check if release.json is a valid JSON
jq . ./release-scripts/release.json

echo "${latest_version}" > ./release-scripts/version

# Upload files to the GitHub release
gh release create "${new_tag}" "${StaticFiles[@]}" \
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

aws s3 cp "release-scripts/release.json" s3://"${PUBLIC_S3_BUCKET}"/cli/"${new_tag}"/
aws s3 cp "release-scripts/version" s3://"${PUBLIC_S3_BUCKET}"/cli/"${new_tag}"/
aws s3 cp "release-scripts/release.json" s3://"${PUBLIC_S3_BUCKET}"/cli/latest/
aws s3 cp "release-scripts/version" s3://"${PUBLIC_S3_BUCKET}"/cli/latest/
