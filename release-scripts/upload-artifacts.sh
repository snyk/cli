#!/usr/bin/env bash
set -euo pipefail

PROTOCOL_VERSION_FILE=$(basename "$(/bin/ls binary-releases/ls-protocol-version*)")

declare -a StaticFiles=(
  "binary-releases/snyk-alpine"
  "binary-releases/snyk-alpine.sha256"
  "binary-releases/snyk-alpine-arm64"
  "binary-releases/snyk-alpine-arm64.sha256"
  "binary-releases/snyk-linux"
  "binary-releases/snyk-linux.sha256"
  "binary-releases/snyk-linux-arm64"
  "binary-releases/snyk-linux-arm64.sha256"
  "binary-releases/snyk-macos"
  "binary-releases/snyk-macos.sha256"
  "binary-releases/snyk-macos-arm64"
  "binary-releases/snyk-macos-arm64.sha256"
  "binary-releases/snyk-win.exe"
  "binary-releases/snyk-win.exe.sha256"
  "binary-releases/sha256sums.txt.asc"
  "binary-releases/$PROTOCOL_VERSION_FILE"
)

declare -a StaticFilesFIPS=(
  "binary-releases/fips/snyk-linux"
  "binary-releases/fips/snyk-linux.sha256"
  "binary-releases/fips/snyk-linux-arm64"
  "binary-releases/fips/snyk-linux-arm64.sha256"
  "binary-releases/fips/snyk-win.exe"
  "binary-releases/fips/snyk-win.exe.sha256"
  "binary-releases/fips/sha256sums.txt.asc"
  "binary-releases/fips/$PROTOCOL_VERSION_FILE"
)

VERSION_TAG="v$(cat binary-releases/version)"
RELEASE_CHANNEL="$($(dirname "$0")/determine-release-channel.sh)"
DRY_RUN=false

if [ ${#} == 0 ]; then
  echo "No upload target defined!"
  exit 1
fi

show_help() {
  echo "Usage: upload-artifacts.sh [options] [arguments]"
  echo "Upload artifacts to GitHub, npm, or S3"
  echo ""
  echo "Options:"
  echo "  -h --help: show this help message and exit"
  echo "  --dry-run: perform a dry run of the upload"
  echo ""
  echo "Arguments:"
  echo "  version       version tag to upload artifacts to"
  echo "  github        upload artifacts to GitHub"
  echo "  npm           upload artifacts to npm"
  echo "  s3            upload artifacts to S3"
  echo ""
  echo "Example:"
  echo "  upload-artifacts.sh v1.0.0 github npm s3"
  echo ""
  echo "  This will upload artifacts to GitHub, npm, and S3 for version v1.0.0"
  echo ""
  echo "  upload-artifacts.sh --dry-run v1.0.0 github npm s3"
  echo ""
  echo "  This will perform a dry run of uploading artifacts to GitHub, npm, and S3 for version v1.0.0"
  echo ""
  echo -e "\033[1;33mTrigger Build and Publish Snyk Images:\033[0m"  # Set color to yellow
  echo ""
  echo "  upload-artifacts.sh trigger-snyk-images"
  echo ""
  echo "  This will trigger the build-and-publish workflow in the snyk-images repository."
  echo ""
}

upload_github() {
  if [ "${DRY_RUN}" == true ]; then
    echo "DRY RUN: uploading draft to GitHub..."
    gh release create "${VERSION_TAG}" "${StaticFiles[@]}" \
      --draft \
      --target "${CIRCLE_SHA1}" \
      --title "${VERSION_TAG}" \
      --notes-file binary-releases/RELEASE_NOTES.md

    echo "DRY RUN: deleting draft from GitHub..."
    gh release delete "${VERSION_TAG}" \
      --yes
  else
    echo "Uploading to GitHub..."
    gh release create "${VERSION_TAG}" "${StaticFiles[@]}" \
      --target "${CIRCLE_SHA1}" \
      --title "${VERSION_TAG}" \
      --notes-file binary-releases/RELEASE_NOTES.md
  fi
}

upload_npm() {
  if [ "${DRY_RUN}" == true ]; then
    echo "DRY RUN: uploading to npm..."
    npm config set '//registry.npmjs.org/:_authToken' "${HAMMERHEAD_NPM_TOKEN}"
    npm publish --dry-run ./binary-releases/snyk-fix.tgz
    npm publish --dry-run ./binary-releases/snyk-protect.tgz
    npm publish --dry-run ./binary-releases/snyk.tgz
  else
    echo "Uploading to npm..."
    npm config set '//registry.npmjs.org/:_authToken' "${HAMMERHEAD_NPM_TOKEN}"
    npm publish ./binary-releases/snyk-fix.tgz
    npm publish ./binary-releases/snyk-protect.tgz
    npm publish ./binary-releases/snyk.tgz
  fi
}

trigger_build_snyk_images() {
  echo "Triggering build-and-publish workflow at snyk-images..."
  echo "Version: $VERSION_TAG"
  echo "Release Channel: $RELEASE_CHANNEL"
  response_file=$TMPDIR/trigger_build_snyk_images_response.txt
  RESPONSE=$(curl -L \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $HAMMERHEAD_GITHUB_PAT" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/repos/snyk/snyk-images/dispatches \
    -d "{\"event_type\":\"build_and_push_images\", \"client_payload\": {\"version\": \"$VERSION_TAG\", \"release_channel\": \"$RELEASE_CHANNEL\"}}" \
    -w "%{http_code}" \
    -s  \
    -o "$response_file")
  if [ "$RESPONSE" -eq 204 ]; then
    echo "Successfully triggered build-and-publish workflow at snyk-images."
  else
    echo "Failed to trigger build-and-publish workflow at snyk-images."
    echo "Response status code: $RESPONSE"
    echo "Details:"
    cat $response_file
    exit 1
  fi
}

upload_s3() {
  version_target=$1
  if [ "${DRY_RUN}" == true ]; then
    echo "DRY RUN: uploading to S3..."
    for filename in "${StaticFiles[@]}"; do
      aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/cli/"${version_target}"/ --dryrun
    done
    aws s3 cp "binary-releases/release.json" s3://"${PUBLIC_S3_BUCKET}"/cli/"${version_target}"/ --dryrun
    aws s3 cp "binary-releases/version" s3://"${PUBLIC_S3_BUCKET}"/cli/"${version_target}"/ --dryrun
    aws s3 cp "binary-releases/RELEASE_NOTES.md" s3://"${PUBLIC_S3_BUCKET}"/cli/"${version_target}"/ --dryrun

    for filename in "${StaticFilesFIPS[@]}"; do
      aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/fips/cli/"${version_target}"/ --dryrun
    done
    aws s3 cp "binary-releases/fips/release.json" s3://"${PUBLIC_S3_BUCKET}"/fips/cli/"${version_target}"/ --dryrun
    aws s3 cp "binary-releases/fips/version" s3://"${PUBLIC_S3_BUCKET}"/fips/cli/"${version_target}"/ --dryrun
    aws s3 cp "binary-releases/fips/RELEASE_NOTES.md" s3://"${PUBLIC_S3_BUCKET}"/fips/cli/"${version_target}"/ --dryrun
  else
    echo "Uploading to S3..."
    for filename in "${StaticFiles[@]}"; do
      aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/cli/"${version_target}"/
    done
    aws s3 cp "binary-releases/release.json" s3://"${PUBLIC_S3_BUCKET}"/cli/"${version_target}"/
    aws s3 cp "binary-releases/version" s3://"${PUBLIC_S3_BUCKET}"/cli/"${version_target}"/
    aws s3 cp "binary-releases/RELEASE_NOTES.md" s3://"${PUBLIC_S3_BUCKET}"/cli/"${version_target}"/

    for filename in "${StaticFilesFIPS[@]}"; do
      aws s3 cp "${filename}" s3://"${PUBLIC_S3_BUCKET}"/fips/cli/"${version_target}"/
    done
    aws s3 cp "binary-releases/fips/release.json" s3://"${PUBLIC_S3_BUCKET}"/fips/cli/"${version_target}"/
    aws s3 cp "binary-releases/fips/version" s3://"${PUBLIC_S3_BUCKET}"/fips/cli/"${version_target}"/
    aws s3 cp "binary-releases/fips/RELEASE_NOTES.md" s3://"${PUBLIC_S3_BUCKET}"/fips/cli/"${version_target}"/
  fi
}

# Capture valid flags
while getopts ":h:-:" opt; do
  case ${opt} in
    h)
      show_help
      exit 0
      ;;
    -)
      case "${OPTARG}" in
        help)
          show_help
          exit 0
          ;;
        dry-run)
          DRY_RUN=true
          ;;
        *)
          echo "Invalid option: --${OPTARG}" >&2
          exit 1
          ;;
      esac
      ;;
    \?)
      echo "Invalid option: ${OPTARG}" >&2
      exit 1
      ;;
  esac
done

# Remove flags from arguments
shift $((OPTIND-1))

# Interpret arguments
for arg in "${@}"; do
   target="${arg}"
    if [ "${arg}" == "version" ]; then
      target="${VERSION_TAG}"
    fi

  # Upload files to the GitHub release
  if [ "${arg}" == "github" ]; then
    upload_github

  # Upload files to npm
  elif [ "${arg}" == "npm" ]; then
    upload_npm

  # Trigger building Snyk images in snyk-images repository
  elif [ "${arg}" == "trigger-snyk-images" ]; then
    trigger_build_snyk_images

  # Upload files to S3 bucket
  else
    upload_s3 "${target}"

    # stable and latest are the same target
    if [ "${target}" == "stable" ]; then
      upload_s3 "latest"
    fi
  fi
done
