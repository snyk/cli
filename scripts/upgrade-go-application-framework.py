import requests
import subprocess

def get_latest_commit_sha():
    url = f"https://api.github.com/repos/snyk/go-application-framework/commits"
    headers = {
        "Accept": "application/vnd.github.v3+json",
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    commits = response.json()
    return commits[0]['sha']

def upgrade_go_application_framework(commit_sha):
    subprocess.run(['go', 'get', '-u', f'github.com/snyk/go-application-framework@{commit_sha}'], cwd='./cliv2', check=True)
    subprocess.run(['go', 'mod', 'tidy'],  cwd='./cliv2', check=True)

if __name__ == "__main__":
    try:
        commit_sha = get_latest_commit_sha()
        print(f"The most recent commit SHA for `go-application-framework` is: {commit_sha}")
        upgrade_go_application_framework(commit_sha)
    except Exception as e:
        print(f"An error occurred: {e}")