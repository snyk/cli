#!/usr/bin/env python3
import os
import re
import sys
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

def log(msg):
    """Print to stderr so it appears in the terminal (stdout is redirected by Makefile)."""
    print(msg, file=sys.stderr)

def manual_license_download(url, package_name):
    folder_path = os.path.join(".", "internal", "embedded", "_data", "licenses", package_name)
    license_file_name = os.path.normpath(os.path.join(folder_path, "LICENSE"))

    if not os.path.exists(license_file_name):
        log(f"Downloading license for {package_name}...")
        os.makedirs(folder_path, exist_ok=True)
        try:
            req = Request(url, headers={"User-Agent": "Snyk-CLI-Build/1.0"})
            with urlopen(req) as response:
                with open(license_file_name, "wb") as license_file:
                    while True:
                        chunk = response.read(8192)
                        if not chunk:
                            break
                        license_file.write(chunk)
        except (HTTPError, URLError) as e:
            log(f"Error downloading license for {package_name}: {e}")
            raise
        log(f"  Downloaded: {package_name}")
    else:
        log(f"  Skipped (already exists): {package_name}")

def main():
    log("Preparing 3rd party licenses...")
    # Try to find all licenses via the go.mod file
    go_bin_path = os.path.join(os.getcwd(), "_cache")
    os.environ["GOBIN"] = go_bin_path
    log("Installing go-licenses...")
    os.system(f"go install github.com/google/go-licenses@latest")
    os.environ["PATH"] += os.pathsep + go_bin_path
    log("Running go-licenses save...")
    os.system(f"go-licenses save ./... --save_path=./internal/embedded/_data/licenses --force --ignore github.com/snyk/cli/cliv2/")

    log("Downloading manual licenses...")
    try:
        manual_license_download("https://raw.githubusercontent.com/davecgh/go-spew/master/LICENSE", "github.com/davecgh/go-spew")
        manual_license_download("https://raw.githubusercontent.com/alexbrainman/sspi/master/LICENSE", "github.com/alexbrainman/sspi")
        manual_license_download("https://raw.githubusercontent.com/pmezard/go-difflib/master/LICENSE", "github.com/pmezard/go-difflib")
        manual_license_download("https://go.dev/LICENSE?m=text", "go.dev")
    except Exception as e:
        log(f"Error downloading license: {e}")
        raise

    # Clean up and print result
    log("Cleaning up non-license files...")
    pattern = re.compile("COPYING|LICENSE|NOTICE.*", flags=re.IGNORECASE)
    for root, dirs, files in os.walk(os.path.join(".", "internal", "embedded", "_data", "licenses")):
        for entry in files:
            p = os.path.join(root, entry)
            if not pattern.match(entry):
                try:
                    if os.access(p, os.W_OK):
                        os.remove(p)
                except:
                    pass
            else:
                print(f"    {p}")

    log("Done preparing 3rd party licenses.")

if __name__ == "__main__":
    main()
