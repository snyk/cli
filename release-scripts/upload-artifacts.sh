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

VERSION_TAG="v$(cat binary-releases/version)"
RELEASE_CHANNEL="$($(dirname "$0")/determine-release-channel.sh)"
DRY_RUN=false

show_help() {
  echo "Usage: upload-artifacts.sh [options] [arguments]"
  echo "Upload artifacts to GitHub, npm, or S3"
  echo ""
  echo "Options:"
  echo "  -h --help: show this help message and exit"
  echo "  --dry-run: perform a dry run of the upload"
  echo ""
  echo "Arguments:"
  echo "  version       upload the versioned S3 folders listed in the artifacts manifest"
  echo "  github        upload artifacts to GitHub"
  echo "  npm           publish the npm packages listed in the artifacts manifest"
  echo "  s3            upload the non-versioned S3 folders listed in the artifacts manifest to S3"
  echo ""
  echo "Example:"
  echo "  upload-artifacts.sh version s3 github npm"
  echo ""
  echo "  This will upload artifacts to the versioned and non-versioned S3 folders, GitHub, and npm"
  echo ""
  echo "  upload-artifacts.sh --dry-run s3 github npm"
  echo ""
  echo "  This will perform a dry run of uploading artifacts to the non-versioned S3 folders, GitHub, and npm"
  echo ""
  echo -e "\033[1;33mTrigger Build and Publish Snyk Images:\033[0m"  # Set color to yellow
  echo ""
  echo "  upload-artifacts.sh trigger-distribution-channels"
  echo ""
  echo "  This will trigger the build-and-publish workflow in the snyk-images repository."
  echo ""
}

upload_github() {
  # Non-stable channels (preview, rc) are published as GitHub prereleases so that
  # the "latest release" pointer consumed by homebrew-tap, scoop-snyk, and install
  # scripts keeps resolving to stable only.
  local prerelease_arg=""
  if [ -n "${RELEASE_CHANNEL}" ] && [ "${RELEASE_CHANNEL}" != "stable" ]; then
    prerelease_arg="--prerelease"
  fi

  if [ "${DRY_RUN}" == true ]; then
    echo "DRY RUN: uploading draft to GitHub..."
    gh release create "${VERSION_TAG}" "${StaticFiles[@]}" \
      --draft \
      ${prerelease_arg} \
      --target "${CIRCLE_SHA1}" \
      --title "${VERSION_TAG}" \
      --notes-file binary-releases/RELEASE_NOTES.md

    echo "DRY RUN: deleting draft from GitHub..."
    gh release delete "${VERSION_TAG}" \
      --yes
  else
    echo "Uploading to GitHub..."
    gh release create "${VERSION_TAG}" "${StaticFiles[@]}" \
      ${prerelease_arg} \
      --target "${CIRCLE_SHA1}" \
      --title "${VERSION_TAG}" \
      --notes-file binary-releases/RELEASE_NOTES.md
  fi
}

# Trigger event for a given repository
# Failure mode is to log and continue as these steps
# are non blocking to a release.
# Recovery is manual trigger on the target repository.
# Arguments:
#   repository: The GitHub repository name (e.g., "scoop-snyk
#   event_type: The event type to trigger (default: "build_and_release")
trigger_repository_event() {
  repository=$1
  event_type=$2

  if [ -z "$1" ]; then
    echo "Error: Missing required argument: repository"
    return 1
  fi

  if [ -z "$2" ]; then
    echo "Error: Missing required argument: event_type"
    return 1
  fi


  echo "Triggering $event_type event on $repository..."
  echo "Version: $VERSION_TAG"
  echo "Release Channel: $RELEASE_CHANNEL"
  response_file=$TMPDIR/trigger_build_$repository.txt
  RESPONSE=$(curl -L \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $HAMMERHEAD_GITHUB_PAT" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/repos/snyk/$repository/dispatches \
    -d "{\"event_type\":\"$event_type\", \"client_payload\": {\"version\": \"$VERSION_TAG\", \"release_channel\": \"$RELEASE_CHANNEL\"}}" \
    -w "%{http_code}" \
    -s  \
    -o "$response_file")
  if [ "$RESPONSE" -eq 204 ]; then
    echo "Successfully triggered $event_type event on $repository."
  else
    echo "Failed to trigger $event_type event on $repository."
    echo "Response status code: $RESPONSE"
    echo "Details:"
    cat $response_file
    return 1
  fi
}

trigger_build_agentic_integration() {
  echo "Triggering build-and-release workflow at agentic-integration-wrappers..."
  echo "Version: $VERSION_TAG"
  echo "Release Channel: $RELEASE_CHANNEL"
  response_file=$TMPDIR/trigger_build_agentic_integration.txt
  RESPONSE=$(curl -L \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $HAMMERHEAD_GITHUB_PAT" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/repos/snyk/agentic-integration-wrappers/dispatches \
    -d "{\"event_type\":\"cli_release\", \"client_payload\": {\"cli_version\": \"$VERSION_TAG\"}}" \
    -w "%{http_code}" \
    -s  \
    -o "$response_file")
  if [ "$RESPONSE" -eq 204 ]; then
    echo "Successfully triggered build-and-release workflow at agentic-integration-wrappers."
  else
    echo "Failed to trigger build-and-release workflow at agentic-integration-wrappers."
    echo "Response status code: $RESPONSE"
    echo "Details:"
    cat $response_file
    exit 1
  fi
}

MANIFEST="binary-releases/artifacts-manifest.json"

check_artifacts() {
  local dir="$1"
  local artifacts="$2"
  local name sha256
  while read -r name _; do
    sha256="$(jq -er --arg name "${name}" '.artifacts[] | select(.name == $name) | .sha256' "${MANIFEST}")"
    echo "${sha256}  ${dir}/${name#./}" | shasum -a 256 -c --quiet -
  done <<< "${artifacts}"
}

upload_artifacts() {
  local dir="$1"
  local artifacts="$2"

  local dry_run_arg=""
  if [ "${DRY_RUN}" == true ]; then
    dry_run_arg="--dryrun"
  fi

  local name folder file
  while read -r name folder; do
    file="${dir}/${name#./}"
    aws s3 cp "${file}" "s3://${PUBLIC_S3_BUCKET}/${folder}$(basename "${file}")" ${dry_run_arg}
  done <<< "${artifacts}"
}

upload_versioned() {
  local artifacts
  artifacts="$(jq -er '.meta.version as $version
    | .artifacts[] | .name as $name
    | .targets[] | select(.type == "s3" and (.path | endswith("/v\($version)/")))
    | "\($name) \(.path)"' "${MANIFEST}")"

  check_artifacts 'binary-releases' "${artifacts}"
  upload_artifacts 'binary-releases' "${artifacts}"
}

upload_s3_non_versioned() {
  local artifacts
  artifacts="$(jq -r '.meta.version as $version
    | .artifacts[] | .name as $name
    | .targets[] | select(.type == "s3" and (.path | endswith("/v\($version)/") | not))
    | "\($name) \(.path)"' "${MANIFEST}")"

  if [[ -z "${artifacts}" ]]; then
    echo "No non-versioned artifacts found (\"dev\" channel?)"
    return
  fi

  check_artifacts 'binary-releases' "${artifacts}"
  upload_artifacts 'binary-releases' "${artifacts}"
}

upload_npm() {
  local channel
  channel="$(jq -er '.meta.releaseChannel' "${MANIFEST}")"

  # Non-stable releases need --tag, otherwise npm rejects prerelease versions as "latest".
  local npm_tag_arg=""
  if [ "${channel}" != "stable" ]; then
    npm_tag_arg="--tag ${channel}"
  fi

  local npm_dry_run_arg=""
  if [ "${DRY_RUN}" == true ]; then
    npm_dry_run_arg="--dry-run"
  fi

  local artifacts
  artifacts="$(jq -r '.artifacts[] | .name as $name
    | select(any(.targets[]; .type == "npm")) | $name' "${MANIFEST}")"
  if [[ -z "${artifacts}" ]]; then
    echo "No npm artifacts found in the manifest"
    return
  fi

  check_artifacts 'binary-releases' "${artifacts}"

  local name
  while read -r name; do
    # shellcheck disable=SC2086
    npm publish ${npm_dry_run_arg} ${npm_tag_arg} "binary-releases/${name#./}"
  done <<< "${artifacts}"
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

if [[ ${#} -eq 0 ]]; then
  echo 'No upload target defined!' >&2
  show_help
  exit 1
fi

# Interpret arguments
for arg in "${@}"; do
  # Upload files to the GitHub release
  if [ "${arg}" == "github" ]; then
    upload_github

  # Upload files to npm
  elif [ "${arg}" == "npm" ]; then
    upload_npm

  # Trigger builds across distribution channel repositories
  elif [ "${arg}" == "trigger-distribution-channels" ]; then
    DISTRIBUTION_FAILURE=0
    
    # 1. Trigger snyk-images
    trigger_repository_event "snyk-images" "build_and_push_images"
    if [ $? -ne 0 ]; then
        DISTRIBUTION_FAILURE=1
    fi
    
    # 2. Trigger scoop-snyk
    trigger_repository_event "scoop-snyk" "build_and_release"
    if [ $? -ne 0 ]; then
        DISTRIBUTION_FAILURE=1
    fi
    
    # 3. Trigger homebrew-tap
    trigger_repository_event "homebrew-tap" "build_and_release"
    if [ $? -ne 0 ]; then
        DISTRIBUTION_FAILURE=1
    fi

    # Exit 1 only after attempting all triggers
    if [ $DISTRIBUTION_FAILURE -eq 1 ]; then
        echo "One or more distribution channel triggers failed. Exiting with error."
        exit 1
    fi


  # Trigger building DXT in agentic-integration-wrappers repository
  elif [ "${arg}" == "trigger_build_agentic_integration" ]; then
    trigger_build_agentic_integration

  elif [ "${arg}" == "version" ]; then
    upload_versioned

  # Upload files to S3 bucket
  elif [ "${arg}" == "s3" ]; then
    upload_s3_non_versioned

  else
    echo "Invalid argument: ${arg}" >&2
    show_help
    exit 1
  fi
done
