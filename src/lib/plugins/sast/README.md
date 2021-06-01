#Snyk Code

##Setup

- Point the cli to your desired proxy in your config local
  `"CODE_CLIENT_PROXY_URL": "https://deeproxy.snyk.io"`
- authenticate the cli with the matching snyk environment:
  https://deeproxy.snyk.io = https://snyk.io
  https://deeproxy.dev.snyk.io = https://dev.snyk.io
- Go to the admin panel for the matching snyk enviroment e.g https://snyk.io/admin
- Enable the SnykCodeCli feature flag on your personal org

To run a snyk code scan run:
`snyk code test`

You can also specify the specific folder to scan the same as the normal cli

This will also accept optional parameter `--sarif` which will output a sarif standard output
