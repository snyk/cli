import argparse
import hashlib
import os
import platform
import urllib.request
import tarfile
import zipfile
import tempfile
import sys

# determine go binary to download and extract
def get_go_binary_name(go_os, go_arch, go_version):
    filename = "go" + go_version + "." + go_os + "-" + go_arch

    # determine file extension
    if go_os == "windows":
        filename += ".zip"
    else:
        filename += ".tar.gz"

    print("Binary to download: " + filename)
    return filename

# calculate sha256sum of file
def calculate_sha256sum(file):
    print("Calculating sha256sum of file: " + file)
    
    try:
        with open(file, "rb") as f:
            sha256sum = hashlib.sha256(f.read()).hexdigest()
    except FileNotFoundError as e:
        print("Error while calculating sha256sum of file:", e)
        sys.exit(1)

    return sha256sum

# extract sha256sum from file contents
def extract_sha256sum_from_file(file):
    print("Extracting sha256sum from file: " + file)

    with open(file, "r") as f:
        first_line = f.readline().strip()  # Read the first line and remove leading/trailing whitespace
        first_word = first_line.split()[0]  # Sp
    
    return first_word

# download a file
def download_file(download_path, filename, base_url):
    url = base_url + filename
    file_path = os.path.join(download_path, filename)

    print("Downloading from: " + url + " to: " + file_path)
    
    try:
        urllib.request.urlretrieve(url, file_path)
        print("Download complete")
    except urllib.error.URLError as e:
        print("Error while downloading the file:", e)
        sys.exit(1)
    
    return file_path

# extract tar file
def extract_tar(tar_gz_file, extract_path):
    print("Extracting: " + tar_gz_file + " to: " + extract_path)
    try:
        with tarfile.open(tar_gz_file, "r:gz") as tar:
            tar.extractall(path=extract_path)
            print("Extraction complete")
    except tarfile.TarError as e:
        print("Error while extracting the tar file: ", e)
        sys.exit(1)

# unzip zip file
def unzip_file(zip_file, extract_path):
    print("Unzipping: " + zip_file + " to: " + extract_path)
    try:
        with zipfile.ZipFile(zip_file, 'r') as zip_ref:
            zip_ref.extractall(extract_path)
            print("Unzipping complete")
    except zipfile.BadZipFile as e:
        print("Error while unzipping the file: ", e)
        sys.exit(1)

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
        help="Base URL to download from (e.g., https://storage.googleapis.com/golang/)",
        default="https://storage.googleapis.com/golang/")
    parser.add_argument("--extraction_path",
        help="Path to download the file to (e.g., /tmp)",
        default=os.getcwd())

    return  parser.parse_args()

if __name__ == "__main__":
    args = init_argparse()

    # check if go is cached, before trying to download and extract it
    file_dir = os.path.join(os.path.abspath(args.extraction_path), "go")
    if  os.path.exists(file_dir):
        print("Restored from cache, skipping download and extraction")
        sys.exit(0)

    # create temporary download path
    download_path = tempfile.gettempdir()

    # determine the go binary to download
    binary_name = get_go_binary_name(args.go_os, args.go_arch, args.version)
    
    # download the go binary
    binary_file = download_file(download_path, binary_name, args.base_url)
    # get the sha256sum of the downloaded file
    binary_file_sha256 = calculate_sha256sum(binary_file)

    # download the sha256sum file for the go binary
    sha256sum_file = download_file(download_path, binary_name + ".sha256", args.base_url)

    # get the expected sha256sum for the downloaded file
    expected_sha256sum = extract_sha256sum_from_file(sha256sum_file)

    # compare the expected sha256sum with the actual sha256sum of the downloaded file
    if expected_sha256sum == binary_file_sha256:
        print("sha256sum check passed.")
        print("  Actual: " + binary_file_sha256)
        print("Expected: " + expected_sha256sum)
    else:
        print("sha256sum check failed.")
        print("  Actual: " + binary_file_sha256)
        print("Expected: " + expected_sha256sum)
        sys.exit(1)

    # extract the downloaded file
    if binary_name.endswith(".zip"):
        unzip_file(binary_file, os.path.abspath(args.extraction_path))
    else:
        extract_tar(binary_file, os.path.abspath(args.extraction_path))
