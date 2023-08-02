import argparse
import hashlib
import os
import platform

import requests


def get_os_arch():
    system = platform.system()
    machine = platform.machine()

    if system == 'Linux':
        if machine == 'x86_64':
            return 'linux', 'amd64'
        elif machine == 'aarch64':
            return 'linux', 'arm64'
        else:
            print("Unsupported architecture for Linux. Aborting download.")
            return None, None
    elif system == 'Windows':
        if machine == 'AMD64':
            return 'windows', 'amd64'
        else:
            print("Unsupported architecture for Windows. Aborting download.")
            return None, None
    elif system == 'Darwin':
        if machine == 'x86_64':
            return 'macos', 'amd64'
        elif machine == 'arm64':
            return 'macos', 'arm64'
        else:
            print("Unsupported architecture for macOS. Aborting download.")
            return None, None
    else:
        print("Unsupported operating system. Aborting download.")
        return None, None


def download_snyk_cli(version):
    os_type, arch_type = get_os_arch()

    if not os_type or not arch_type:
        return

    filename = get_filename(arch_type, os_type)

    url = f"https://static.snyk.io/cli/v{version}/{filename}"

    response = requests.get(url)

    if response.status_code == 200:
        sha_response = requests.get(url + ".sha256")
        if not sha_response:
            print("SHA256 checksum not available. Aborting download.")
            return

        sha256_checksum = sha_response.text.split()[0]

        downloaded_file_path = filename

        with open(downloaded_file_path, 'wb') as f:
            f.write(response.content)

        if verify_checksum(downloaded_file_path, sha256_checksum):
            os.rename(downloaded_file_path, filename)
            print(f"Snyk CLI v{version} downloaded successfully to {filename}")

            # Make the file executable
            os.chmod(filename, 0o755)

            print("Running 'snyk -v' to check the version:")

            executable = os.path.join(os.getcwd(), filename)
            os.system(f"{executable} -v")

        else:
            os.remove(downloaded_file_path)
            print("SHA256 checksum verification failed. Downloaded file deleted.")
    else:
        print(f"Failed to download Snyk CLI v{version}")


def get_filename(arch_type, os_type):
    filename = ""
    if os_type == 'linux' and arch_type == 'arm64':
        filename = "snyk-linux-arm64"
    if os_type == 'linux' and arch_type == 'amd64':
        filename = "snyk-linux"
        stat_result = os.path.exists("/lib/ld-musl-x86_64.so.1")
        if stat_result:
            filename = "snyk-alpine"
    if os_type == 'windows' and arch_type == 'amd64':
        filename = "snyk-win.exe"
    if os_type == 'macos':
        filename = "snyk-macos"
    return filename


def verify_checksum(file_path, expected_checksum):
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while True:
            data = f.read(65536)
            if not data:
                break
            sha256.update(data)
    return sha256.hexdigest() == expected_checksum


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download and install a specific version of Snyk CLI.")
    parser.add_argument("version", help="Version of Snyk CLI to download (e.g., 1.123.456)")

    args = parser.parse_args()
    version = args.version

    download_snyk_cli(version)
