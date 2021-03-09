#!/usr/bin/env bash
set -e

gh_latest_release_tag=$(gh api repos/"${CIRCLE_PROJECT_USERNAME}"/"${CIRCLE_PROJECT_REPONAME}"/releases/latest | jq .tag_name -r)
echo "gh_latest_release_tag: ${gh_latest_release_tag}"
[[ ! $gh_latest_release_tag =~ ^v[0-9.]+$ ]] && echo "gh_latest_release_tag is not a valid version" && exit 1

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

# Upload files to the GitHub release
for filename in "${StaticFiles[@]}"; do
  gh release upload "${gh_latest_release_tag}" "${filename}"
done

# Upload files to the versioned folder
for filename in "${StaticFiles[@]}"; do
  aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/cli/"${gh_latest_release_tag}"/
done

# Upload files to the /latest folder
for filename in "${StaticFiles[@]}"; do
  aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/cli/latest/
done
