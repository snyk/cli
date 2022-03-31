#!/usr/bin/env bash
set -euo pipefail

platform="${1}"
arch="${2}"
node_version="v16.14.2"
node_url="https://nodejs.org/dist/${node_version}/node-${node_version}-${platform}-${arch}.tar.gz"
build_name="snyk-for-docker-desktop-${platform}-${arch}"
build_filename="${build_name}.tar.gz"
build_sha_filename="${build_filename}.sha256"
build_root="./docker-desktop/dist/${build_name}"
build_dir_name="docker"
build_dir="${build_root}/${build_dir_name}"
output_dir="./binary-releases"

if [[ -d "${build_dir}" ]]; then
  echo "ERROR: Build directory already exists."
  echo "  - ${build_dir}"
  exit 1
fi

mkdir -p "${build_dir}"
mkdir -p "${output_dir}"

# Include entrypoint.
cp ./docker-desktop/src/snyk-mac.sh "${build_dir}"

# Include Snyk CLI build.
cp              ./package.json        "${build_dir}"
cp              ./config.default.json "${build_dir}"
cp -r           ./dist                "${build_dir}"
cp -r           ./bin                 "${build_dir}"
cp -r           ./pysrc               "${build_dir}"
cp -r --parents ./help/cli-commands   "${build_dir}"

# Include NodeJS.
#
# --strip-components=1 removes the versioned NodeJS directory so that we can
# refer to the contents without needing to know the exact release name it came
# from.
mkdir "${build_dir}/node-release"
pushd "${build_dir}/node-release"
curl "${node_url}" | tar -xz --strip-components=1
popd

# Create Snyk CLI for Docker Desktop build
#
# We build from build_root so that build_name is the top-level directory in the
# tarball. We want a top-level directory to avoid tarbombs.
pushd "${build_root}"
tar czfh "${build_filename}" "${build_dir_name}"
shasum -a 256 "${build_filename}" > "${build_sha_filename}"
popd

mv "${build_root}/${build_filename}"     "${output_dir}"
mv "${build_root}/${build_sha_filename}" "${output_dir}"
