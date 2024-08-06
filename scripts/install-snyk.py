#!/usr/bin/env python3
import argparse
import hashlib
import os
import platform
import time

import requests

primary_url = "https://downloads.snyk.io"
secondary_url = "https://static.snyk.io"
urls = [primary_url, secondary_url]

def get_os_arch():
    system = platform.system()
    machine = platform.machine()

    if system == "Linux":
        if machine == "x86_64":
            return "linux", "amd64"
        elif machine == "aarch64":
            return "linux", "arm64"
        else:
            print("Unsupported architecture for Linux. Aborting download.")
            return None, None
    elif system == "Windows":
        if machine == "AMD64":
            return "windows", "amd64"
        else:
            print("Unsupported architecture for Windows. Aborting download.")
            return None, None
    elif system == "Darwin":
        if machine == "x86_64":
            return "macos", "amd64"
        elif machine == "arm64":
            return "macos", "arm64"
        else:
            print("Unsupported architecture for macOS. Aborting download.")
            return None, None
    else:
        print("Unsupported operating system. Aborting download.")
        return None, None


def download_snyk_cli(download_version, base_url):
    success = 0
    fail = 1
    abort = 2

    os_type, arch_type = get_os_arch()

    if not os_type or not arch_type:
        return abort

    filename, output_filename = get_filename(arch_type, os_type)

    is_non_prefixed_version = download_version in ["latest", "stable", "preview", "rc"]
    if not is_non_prefixed_version:
        if download_version[0] != "v":  # Add a "v" prefix if it's missing
            download_version = f"v{download_version}"

    url = f"{base_url}/cli/{download_version}/{filename}"

    print(f"Downloading '{filename}' from: {url}")

    try:
        response = requests.get(url)

        if response.status_code == 200:
            sha_response = requests.get(url + ".sha256")
            if not sha_response:
                print("SHA256 checksum not available. Aborting download.")
                return abort

            sha256_checksum = sha_response.text.split()[0]

            downloaded_file_path = filename

            with open(downloaded_file_path, "wb") as f:
                f.write(response.content)

            print("Verifying checksum")
            if verify_checksum(downloaded_file_path, sha256_checksum):
                print("Checksum verified")
                os.rename(downloaded_file_path, filename)
                print(f"Snyk CLI {download_version} downloaded successfully to {filename}")

                # Make the file executable
                os.chmod(filename, 0o755)
                os.rename(filename, output_filename)

                print("Running 'snyk -v' to check the version:")

                executable = os.path.join(os.getcwd(), output_filename)
                os.system(f"{executable} -v")

            else:
                os.remove(downloaded_file_path)
                print("SHA256 checksum verification failed. Downloaded file deleted.")
                return fail
            return success
        else:
            print(f"Failed to download Snyk CLI {download_version} via {base_url}")
            return fail
    except requests.RequestException as e:
        print(f"Error trying to download Snyk CLI {download_version} via {base_url}: {e}")
        return fail


# will try to download via the base_url 'retries' amount of times
def download_with_retry(retries, base_url):
    for retry in range(1, retries + 1):
        print(
            "Trying to download version "
            + str(args.version)
            + ": #"
            + str(retry)
            + " of #"
            + str(retries)
        )
        download_status = download_snyk_cli(args.version, base_url)
        
        # download failed - retry
        if download_status == 1:
            sleep_time = retry * 10
            print(
                "Failed to download Snyk CLI. Retrying in "
                + str(sleep_time)
                + " seconds..."
            )
            time.sleep(sleep_time)
        
        # download ok && 'abort' failures
        else:
            break

    return download_status

def get_filename(arch_type, os_type):
    filename = ""
    output_filename = "snyk"
    suffix = ""

    if os_type == "linux" and arch_type == "arm64":
        filename = "snyk-linux-arm64"
    if os_type == "linux" and arch_type == "amd64":
        filename = "snyk-linux"
        stat_result = os.path.exists("/lib/ld-musl-x86_64.so.1")
        if stat_result:
            filename = "snyk-alpine"
    if os_type == "windows" and arch_type == "amd64":
        filename = "snyk-win"
        suffix = ".exe"
    if os_type == "macos" and arch_type == "amd64":
        filename = "snyk-macos"
    if os_type == "macos" and arch_type == "arm64":
        filename = "snyk-macos-arm64"

    filename = filename + suffix
    output_filename = output_filename + suffix

    return filename, output_filename


def verify_checksum(file_path, expected_checksum):
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while True:
            data = f.read(65536)
            if not data:
                break
            sha256.update(data)
    return sha256.hexdigest() == expected_checksum


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download and install a specific version of Snyk CLI."
    )
    parser.add_argument(
        "version", help="Version of Snyk CLI to download (e.g., 1.123.456)"
    )
    parser.add_argument(
        "--base_url", help="Base URL to download from", default=primary_url
    )
    parser.add_argument("--retry", help="number of retries", default=3)

    args = parser.parse_args()

    # check if we should add args.base_url to list of urls
    urls_includes_base_url = args.base_url in urls
    if not urls_includes_base_url:
        urls.insert(0, args.base_url)

    # iterate list of urls and try to download the CLI
    # retry 'args.retry' times before iterating to the next URL
    # aborted downloads will iterate to the next URL without retrying
    for url in urls:
        download_status = download_with_retry(args.retry, url)
        if download_status == 0:
            break
