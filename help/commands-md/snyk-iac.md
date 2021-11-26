# snyk-iac(1) -- Find security issues in your Infrastructure as Code files

## Usage

`snyk` `iac` [<COMMAND>][<options>] <PATH>

## Description

Find security issues in your Infrastructure as Code files.

[For more information see IaC help page](https://snyk.co/ucT6Q)

## Commands

### `test`

Test for any known issue.

## Options

### `--detection-depth=<DEPTH>`

(only in `test` command)
Indicate the maximum depth of sub-directories to search. `<DEPTH>` must be a number.

Default: No Limit
Example: `--detection-depth=3`
Will limit search to provided directory (or current directory if no `<PATH>` provided) plus two levels of subdirectories.

### `--severity-threshold=low|medium|high|critical`

Only report configuration issues with the provided severity level or higher. Please note that the Snyk Infrastructure as Code configuration issues do not currently use the `critical` severity level.

### `--ignore-policy`

Ignores all set policies. The current policy in `.snyk` file, Org level ignores and the project policy on snyk.io.

### `--json`

Prints results in JSON format.

### `--json-file-output=<OUTPUT_FILE_PATH>`

(only in `test` command)
Save test output in JSON format directly to the specified file, regardless of whether or not you use the `--json` option.
This is especially useful if you want to display the human-readable test output via stdout and at the same time save the JSON format output to a file.

### `--org=<ORG_NAME>`

Specify the `<ORG_NAME>` to run Snyk commands tied to a specific organization. This will influence private tests limits.
If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_NAME>`

Setting a default will ensure all newly tested projects will be tested
under your default organization. If you need to override the default, you can use the `--org=<ORG_NAME>` argument.
Default: uses `<ORG_NAME>` that sets as default in your [Account settings](https://app.snyk.io/account)

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a snyk policy file.

### `--sarif`

Return results in SARIF format.

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

(only in `test` command)
Save test output in SARIF format directly to the `<OUTPUT_FILE_PATH>` file, regardless of whether or not you use the `--sarif` option.
This is especially useful if you want to display the human-readable test output via stdout and at the same time save the SARIF format output to a file.

### `--scan=<TERRAFORM_PLAN_SCAN_MODE>`

Dedicated flag for Terraform plan scanning modes.
It enables to control whether the scan should analyse the full final state (e.g. `planned-values`), or the proposed changes only (e.g. `resource-changes`).
Default: If the `--scan` flag is not provided it would scan the proposed changes only by default.
Example #1: `--scan=planned-values` (full state scan)
Example #2: `--scan=resource-changes` (proposed changes scan)

### `--rules=<PATH_TO_CUSTOM_RULES_BUNDLE>`

Dedicated flag for Custom Rules scanning.
It enables the IaC scans to use a custom rules bundle generated via the `snyk-iac-rules` SDK. To download it and learn how to use it, go to
https://github.com/snyk/snyk-iac-rules.
This flag cannot be used if the custom rules settings were configured via the Snyk UI.
Default: If the `--rules` flag is not provided it would scan the configuration files using the internal Snyk rules only.
Example: `--rules=bundle.tar.gz` (scans the configuration files using custom rules and internal Snyk rules)




### Flags available accross all commands

#### `--insecure`

Ignore unknown certificate authorities.

#### `-d`

Output debug logs.

#### `--quiet`, `-q`

Silence all output.

#### `--version`, `-v`

Prints versions.

#### `--help [<COMMAND>]`, `[<COMMAND>] --help`, `-h`

Prints a help text. You may specify a `<COMMAND>` to get more details.


## Examples

[For more information see IaC help page](https://snyk.co/ucT6Q)

### `Test CloudFormation file`

\$ snyk iac test /path/to/cloudformation_file.yaml

### `Test kubernetes file`

\$ snyk iac test /path/to/kubernetes_file.yaml

### `Test terraform file`

\$ snyk iac test /path/to/terraform_file.tf

### `Test terraform plan file`

\$ snyk iac test /path/to/tf-plan.json

### `Test ARM file`

\$ snyk iac test /path/to/arm_file.json

### `Test matching files in a directory`

\$ snyk iac test /path/to/directory

### `Test matching files in a directory using a local custom rules bundle`

\$ snyk iac test /path/to/directory --rules=bundle.tar.gz


## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulns found<br />
**1**: action_needed, vulns found<br />
**2**: failure, try to re-run command<br />
**3**: failure, no supported projects detected<br />


## Environment

You can set these environment variables to change CLI settings.

### `SNYK_TOKEN`

Snyk authorization token. Setting this envvar will override the token that may be available in your `snyk config` settings.

[How to get your account token](https://snyk.co/ucT6J)<br />
[How to use Service Accounts](https://snyk.co/ucT6L)<br />

### `SNYK_CFG_KEY`

Allows you to override any key that's also available as `snyk config` option.

E.g. `SNYK_CFG_ORG=myorg` will override default org option in `config` with "myorg".

### `SNYK_REGISTRY_USERNAME`

Specify a username to use when connecting to a container registry. Note that using the `--username` flag will
override this value. This will be ignored in favour of local Docker binary credentials when Docker is present.

### `SNYK_REGISTRY_PASSWORD`

Specify a password to use when connecting to a container registry. Note that using the `--password` flag will
override this value. This will be ignored in favour of local Docker binary credentials when Docker is present.

## Connecting to Snyk API

By default Snyk CLI will connect to `https://snyk.io/api/v1`.

### `SNYK_API`

Sets API host to use for Snyk requests. Useful for on-premise instances and configuring proxies. If set with `http` protocol CLI will upgrade the requests to `https`. Unless `SNYK_HTTP_PROTOCOL_UPGRADE` is set to `0`.

### `SNYK_HTTP_PROTOCOL_UPGRADE=0`

If set to the value of `0`, API requests aimed at `http` URLs will not be upgraded to `https`. If not set, the default behavior will be to upgrade these requests from `http` to `https`. Useful e.g., for reverse proxies.

### `HTTPS_PROXY` and `HTTP_PROXY`

Allows you to specify a proxy to use for `https` and `http` calls. The `https` in the `HTTPS_PROXY` means that _requests using `https` protocol_ will use this proxy. The proxy itself doesn't need to use `https`.


## Notices

### Snyk API usage policy

The use of Snyk's API, whether through the use of the 'snyk' npm package or otherwise, is subject to the terms & conditions
https://snyk.co/ucT6N

