#!/usr/bin/env python3
import argparse
import subprocess

import requests


def get_latest_commit_sha(name):
    url = f"https://api.github.com/repos/snyk/{name}/commits"
    headers = {
        "Accept": "application/vnd.github.v3+json",
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    commits = response.json()
    return commits[0]['sha']


def upgrade_go_mod(name, commit_sha):
    subprocess.run(['go', 'get', '-u', f'github.com/snyk/{name}@{commit_sha}'], cwd='./cliv2', check=True)
    subprocess.run(['go', 'mod', 'tidy'], cwd='./cliv2', check=True)


def upgrade_dep(name):
    commit_sha = get_latest_commit_sha(name)
    print(f"The most recent commit SHA for {name} is: {commit_sha}")
    upgrade_go_mod(name, commit_sha)


if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser(description="Download a Snyk CLI go mod dependency")
        parser.add_argument("--name", help="Repository name to download from (e.g., go-application-framework)",
                            default="", required=False)
        args = parser.parse_args()

        if args.name == "":
            upgrade_dep("go-application-framework")
            upgrade_dep("snyk-ls")
        else:
            upgrade_dep(args.name)
    except Exception as e:
        print(f"An error occurred: {e}")
