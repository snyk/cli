#!/usr/bin/env bash
set -uo pipefail

VERSION_TAG="v$(cat binary-releases/version)"

TAG_FOUND=$(git -P tag --list --contains)
if [ "${TAG_FOUND}" != "" ]; then
    echo "This commit has already been released."
    exit 1
fi

aws s3 ls s3://"${PUBLIC_S3_BUCKET}"/cli/"${VERSION_TAG}"/
if [ "${?}" -eq "0" ]; then
    echo "Version ${VERSION_TAG} has already been released."
    exit 1
fi

echo "Version ${VERSION_TAG} LGTM!"
