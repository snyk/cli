#!/usr/bin/env bash
set -euo pipefail

BINARY_OUTPUT_FOLDER=${1}
BINARY_WRAPPER_DIR=${2}
ROOT=$(pwd)

# create legacy TS tarball
mv "$(npm pack)" "${BINARY_OUTPUT_FOLDER}/snyk_legacy.tgz"

# create TS binary wrapper tarball
pushd .
cd "${BINARY_WRAPPER_DIR}"
mv "$(npm pack)" "${ROOT}/${BINARY_OUTPUT_FOLDER}/snyk_wrapper.tgz"
popd 

# merge the two tarballs and repack them to the final file
pushd .
cd "${BINARY_OUTPUT_FOLDER}"
tar -xf snyk_legacy.tgz
tar -xf snyk_wrapper.tgz
cd package
mv "$(npm pack)" "${ROOT}/${BINARY_OUTPUT_FOLDER}/snyk.tgz"
popd 

# cleanup intermediate files and folders
rm -rf "${ROOT}/${BINARY_OUTPUT_FOLDER}/package"
rm -rf "${ROOT}/${BINARY_OUTPUT_FOLDER}/snyk_legacy.tgz"
rm -rf "${ROOT}/${BINARY_OUTPUT_FOLDER}/snyk_wrapper.tgz"
