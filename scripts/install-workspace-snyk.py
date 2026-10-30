#!/usr/bin/env python3
"""Installs a Snyk CLI binary from a build directory as ./snyk (./snyk.exe on Windows).

Used by the E2E jobs to test the binaries built in the CI workspace. The binary is
picked by the OS and architecture of the machine and verified against its .sha256 file.
"""
import argparse
import hashlib
import os
import platform
import shutil
import subprocess
import sys


def get_os_arch():
    system = platform.system()
    machine = platform.machine()

    if system == "Linux":
        if machine == "x86_64":
            return "linux", "amd64"
        if machine == "aarch64":
            return "linux", "arm64"
    elif system == "Windows":
        if machine == "AMD64":
            return "windows", "amd64"
    elif system == "Darwin":
        if machine == "x86_64":
            return "macos", "amd64"
        if machine == "arm64":
            return "macos", "arm64"

    return None, None


def is_alpine():
    try:
        with open("/etc/os-release", "r") as f:
            return "id=alpine" in f.read().lower()
    except OSError:
        return False


def get_filename(os_type, arch_type):
    suffix = ""

    if os_type == "linux" and arch_type == "arm64":
        filename = "snyk-alpine-arm64" if is_alpine() else "snyk-linux-arm64"
    elif os_type == "linux" and arch_type == "amd64":
        filename = "snyk-alpine" if is_alpine() else "snyk-linux"
    elif os_type == "windows" and arch_type == "amd64":
        filename = "snyk-win"
        suffix = ".exe"
    elif os_type == "macos" and arch_type == "amd64":
        filename = "snyk-macos"
    else:
        filename = "snyk-macos-arm64"

    return filename + suffix, "snyk" + suffix


def verify_checksum(file_path, expected_checksum):
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while True:
            data = f.read(65536)
            if not data:
                break
            sha256.update(data)
    return sha256.hexdigest() == expected_checksum


def install(binary_dir):
    os_type, arch_type = get_os_arch()
    if not os_type:
        print(f"Unsupported platform: {platform.system()} {platform.machine()}")
        return 1

    filename, output_filename = get_filename(os_type, arch_type)
    source = os.path.join(binary_dir, filename)
    checksum_file = source + ".sha256"

    for path in (source, checksum_file):
        if not os.path.isfile(path):
            print(f"'{path}' not found.")
            return 1

    print(f"Installing '{source}'")

    with open(checksum_file) as f:
        expected_checksum = f.read().split()[0]
    if not verify_checksum(source, expected_checksum):
        print("SHA256 checksum verification failed.")
        return 1
    print("Checksum verified")

    shutil.copyfile(source, output_filename)
    os.chmod(output_filename, 0o755)

    print("Running 'snyk -v' to check the version:")
    return subprocess.run([os.path.join(os.getcwd(), output_filename), "-v"]).returncode


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Install a Snyk CLI binary from a build directory."
    )
    parser.add_argument(
        "binary_dir",
        help="Directory with the built binaries (e.g. binary-releases or binary-releases/fips)",
    )
    sys.exit(install(parser.parse_args().binary_dir))
