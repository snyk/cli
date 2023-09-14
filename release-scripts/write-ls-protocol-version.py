#!/usr/bin/env python3
import os

import requests
import yaml
import sys


def get_goreleaser_yaml(commit) -> int:
    # Define the GitHub repository URL and API endpoint
    api_url = f'https://api.github.com/repos/snyk/snyk-ls/contents/.goreleaser.yaml?ref={commit}'

    # Send a GET request to the GitHub API
    response = requests.get(api_url)

    if response.status_code == 200:
        # Parse the JSON response to get the content URL
        content_url = response.json()['download_url']

        # Fetch the content of the .goreleaser.yaml file
        content_response = requests.get(content_url)

        if content_response.status_code == 200:
            yaml_content = content_response.text

            # Parse the YAML content
            yaml_data = yaml.safe_load(yaml_content)

            # Extract the value of LS_PROTOCOL_VERSION under env
            env_variables = yaml_data.get('env', [])
            for env_var in env_variables:
                if isinstance(env_var, str) and env_var.startswith("LS_PROTOCOL_VERSION="):
                    prot_version = env_var.split('=')[1]
                    return int(prot_version)

            print("LS_PROTOCOL_VERSION not found in .goreleaser.yaml")
            return -1
        else:
            print(f"Failed to fetch .goreleaser.yaml content: {content_response.status_code}")
            return -2
    else:
        print(f"Failed to retrieve commit information: {response.status_code}")
        return -3


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python script.py <commit_hash> <version> <output-directory>")
        sys.exit(1)

    commit_hash = sys.argv[1]
    ls_protocol_version = get_goreleaser_yaml(commit_hash)
    if ls_protocol_version < 0:
        print("Failed to retrieve LS_PROTOCOL_VERSION")
        sys.exit(1)

    with open(os.path.join(sys.argv[3], f"ls-protocol-version-{ls_protocol_version}"), 'w') as writer:
        writer.write(sys.argv[2])

    print(ls_protocol_version)
    sys.exit(0)
