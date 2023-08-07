import argparse
import hashlib
import os
import platform
import urllib.request
import tarfile
import zipfile

# determine go binary to download and extract
def get_go_binary_name(go_os, go_arch, go_version):
    filename = "go" + go_version + "." + go_os + "-" + go_arch

    # determine file extension
    if go_os == "windows":
        filename += ".zip"
    else:
        filename += ".tar.gz"

    # e.g. go1.20.linux-amd64.tar.gz
    return filename

# download go binary
def download_go_binary(filename, base_url, download_path):
    url = base_url + filename

    # download the file to the download path
    print("Downloading " + url + " to " + download_path + "/" + filename)
    try:
        urllib.request.urlretrieve(url, filename)
        print("Download complete")
    except urllib.error.URLError as e:
        print("Error while downloading the file:", e)

# extract tar file
def extract_tar(tar_gz_file, extract_path):
    print("Extracting " + tar_gz_file + " to " + extract_path)
    try:
        with tarfile.open(tar_gz_file, "r:gz") as tar:
            tar.extractall(path=extract_path)
            print("Extraction complete")
    except tarfile.TarError as e:
        print("Error while extracting the tar file:", e)

# unzip zip file
def unzip_file(zip_file, extract_path):
    print("Unzipping " + zip_file + " to " + extract_path)
    try:
        with zipfile.ZipFile(zip_file, 'r') as zip_ref:
            zip_ref.extractall(extract_path)
            print("Unzipping complete")
    except zipfile.BadZipFile as e:
        print("Error while unzipping the file:", e)

# setup argparse
def init_argparse():
    parser = argparse.ArgumentParser(
        prog="download_go",
        description="Download and install a specific version of Go."
        )
    parser.add_argument("version", help="Version of Go to download (e.g., 1.20)")
    parser.add_argument("--go_os",
        help="OS to download for (e.g., linux, windows, darwin)",
        choices=["linux", "windows", "darwin"],
        required=True)
    parser.add_argument("--go_arch",
        help="Architecture to download for (e.g., amd64, arm64)",
        choices=["amd64", "arm64", "armv6l"],
        required=True)
    parser.add_argument("--base_url",
        help="Base URL to download from (e.g., https://go.dev/dl/)",
        choices=["https://go.dev/dl/", "https://aka.ms/golang/release/latest/"],
        default="https://go.dev/dl/")
    parser.add_argument("--download_path",
        help="Path to download the file to (e.g., /tmp)",
        default=os.getcwd())

    return  parser.parse_args()

if __name__ == "__main__":
    args = init_argparse()
    # download and extract the go binary
    binary_name = get_go_binary_name(args.go_os, args.go_arch, args.version)
    download_go_binary(binary_name, args.base_url, args.download_path)
    if args.go_os == "windows":
        unzip_file(binary_name, args.download_path)
    else:
        extract_tar(binary_name, args.download_path)
