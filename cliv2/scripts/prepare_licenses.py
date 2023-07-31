#!/usr/bin/env python3
import os
import requests
import re

def manual_license_download(url, package_name):
    folder_path = os.path.join(".", "internal", "embedded", "_data", "licenses", package_name)
    license_file_name = os.path.normpath(os.path.join(folder_path, "LICENSE"))

    if not os.path.exists(license_file_name):
        os.makedirs(folder_path, exist_ok=True)
        with requests.get(url, stream=True, allow_redirects=True) as response:
            response.raise_for_status()
            with open(license_file_name, "wb") as license_file:
                for chunk in response.iter_content(chunk_size=8192):
                    license_file.write(chunk)

def main():
    # Try to find all licenses via the go.mod file
    go_bin_path = os.path.join(os.getcwd(), "_cache")
    os.environ["GOBIN"] = go_bin_path
    os.system(f"go install github.com/google/go-licenses@latest")
    os.environ["PATH"] += os.pathsep + go_bin_path
    os.system(f"go-licenses save ./... --save_path=./internal/embedded/_data/licenses --force --ignore github.com/snyk/cli/cliv2/")

    manual_license_download("https://raw.githubusercontent.com/davecgh/go-spew/master/LICENSE", "github.com/davecgh/go-spew")
    manual_license_download("https://raw.githubusercontent.com/alexbrainman/sspi/master/LICENSE", "github.com/alexbrainman/sspi")
    manual_license_download("https://raw.githubusercontent.com/pmezard/go-difflib/master/LICENSE", "github.com/pmezard/go-difflib")
    manual_license_download("https://go.dev/LICENSE?m=text", "go.dev")

    # Clean up and print result
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

if __name__ == "__main__":
    main()
