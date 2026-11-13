#!/usr/bin/env bash
set -euo pipefail

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
  echo "  github        create the GitHub release from the artifacts manifest"
  echo "  npm           upload artifacts to npm"
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
  local version commit channel tag
  version="$(jq -er '.meta.version' "${MANIFEST}")"
  commit="$(jq -er '.meta.commit' "${MANIFEST}")"
  channel="$(jq -er '.meta.releaseChannel' "${MANIFEST}")"
  tag="v${version}"

  local github_artifacts
  github_artifacts="$(jq -r '.artifacts[] | select(any(.targets[]; .type == "github")) | .name' "${MANIFEST}")"
  if ! grep -qxF './RELEASE_NOTES.md' <<< "${github_artifacts}"; then
    echo "The manifest has no RELEASE_NOTES.md with a github target" >&2
    exit 1
  fi
  # RELEASE_NOTES.md is the GH Release's body, not a GH Release asset.
  local assets
  assets="$(grep -vxF './RELEASE_NOTES.md' <<< "${github_artifacts}")" || true
  if [[ -z "${assets}" ]]; then
    echo "The manifest has no non-RELEASE_NOTES.md artifacts with a github target" >&2
    exit 1
  fi

  # GitHub release assets are flat: a file in a folder would be published under its base name.
  local asset
  while read -r asset; do
    if [[ "${asset#./}" == */* ]]; then
      echo "GitHub release assets can't be in a folder: ${asset}" >&2
      exit 1
    fi
  done <<< "${assets}"

  # Non-stable channels (preview, rc, dev) are published as GitHub prereleases so that
  # the "latest release" pointer consumed by homebrew-tap, scoop-snyk, and install
  # scripts keeps resolving to stable only.
  local prerelease_arg=""
  if [ "${channel}" != "stable" ]; then
    prerelease_arg="--prerelease"
  fi

  echo "GitHub release ${tag} at ${commit} (channel: ${channel}, prerelease?: ${prerelease_arg:-false})"
  echo "Assets:"
  # shellcheck disable=SC2001 # Parameter expansion can't strip a leading "./" from each line of a multi-line string.
  sed -e 's|^\./|  |' <<< "${assets}"

  check_artifacts 'binary-releases' "${github_artifacts}"

  local files=() name
  while read -r name; do
    files+=("binary-releases/${name#./}")
  done <<< "${assets}"

  local draft_arg=""
  if [ "${DRY_RUN}" == true ]; then
    echo "DRY RUN: uploading draft to GitHub..."
    draft_arg="--draft"
  else
    echo "Uploading to GitHub..."
  fi

  gh release create "${tag}" "${files[@]}" \
    ${draft_arg} \
    ${prerelease_arg} \
    --target "${commit}" \
    --title "${tag}" \
    --notes-file binary-releases/RELEASE_NOTES.md

  if [ "${DRY_RUN}" == true ]; then
    echo "DRY RUN: deleting draft from GitHub..."
    gh release delete "${tag}" \
      --yes
  fi
}

upload_npm() {
  # For non-stable releases, specify --tag to avoid npm's prerelease version error
  local npm_tag_arg=""
  if [ -n "${RELEASE_CHANNEL}" ] && [ "${RELEASE_CHANNEL}" != "stable" ]; then
    npm_tag_arg="--tag ${RELEASE_CHANNEL}"
  fi

  if [ "${DRY_RUN}" == true ]; then
    echo "DRY RUN: uploading to npm..."
    npm publish --dry-run ${npm_tag_arg} ./binary-releases/snyk-fix.tgz
    npm publish --dry-run ${npm_tag_arg} ./binary-releases/snyk-protect.tgz
    npm publish --dry-run ${npm_tag_arg} ./binary-releases/snyk.tgz
  else
    echo "Uploading to npm..."
    npm publish ${npm_tag_arg} ./binary-releases/snyk-fix.tgz
    npm publish ${npm_tag_arg} ./binary-releases/snyk-protect.tgz
    npm publish ${npm_tag_arg} ./binary-releases/snyk.tgz
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

upload_s3_artifacts() {
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

upload_s3_versioned() {
  local artifacts
  artifacts="$(jq -er '.meta.version as $version
    | .artifacts[] | .name as $name
    | .targets[] | select(.type == "s3" and (.path | endswith("/v\($version)/")))
    | "\($name) \(.path)"' "${MANIFEST}")"

  check_artifacts 'binary-releases' "${artifacts}"
  upload_s3_artifacts 'binary-releases' "${artifacts}"
}

upload_s3_non_versioned() {
  local artifacts
  artifacts="$(jq -er '.meta.version as $version
    | .artifacts[] | .name as $name
    | .targets[] | select(.type == "s3" and (.path | endswith("/v\($version)/") | not))
    | "\($name) \(.path)"' "${MANIFEST}")"

  check_artifacts 'binary-releases' "${artifacts}"
  upload_s3_artifacts 'binary-releases' "${artifacts}"
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
    upload_s3_versioned

  # Upload files to S3 bucket
  elif [ "${arg}" == "s3" ]; then
    upload_s3_non_versioned

  else
    echo "Invalid argument: ${arg}" >&2
    show_help
    exit 1
  fi
done
