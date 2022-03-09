# Container

## Usage

`snyk container <COMMAND> [<OPTIONS>] [<IMAGE>]`

## Description

The `snyk container` command tests container images for vulnerabilities.

For more information see [Snyk CLI for container security](https://docs.snyk.io/products/snyk-container/snyk-cli-for-container-security).

## Commands

### `test`

Test for any known vulnerabilities.

### `monitor`

Capture the container image layers and dependencies and monitor for vulnerabilities on snyk.io

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulnerabilities found\
**1**: action_needed, vulnerabilities found\
**2**: failure, try to re-run command\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. There are environment variables that apply to the container command. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--print-deps`

Print the dependency tree before sending it for analysis.

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences some features availability and private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested and monitored projects are tested and monitored under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account).

Example: `$ snyk container test ubuntu:18.04 --org=my-team`

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI).

### `--file=<FILE_PATH>`

For more detailed advice, include the path to the Dockerfile for the image.

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results in JSON format, useful for integrating with other tools

Example: `$ snyk container test --json-file-output=vuln.json`

### `--json-file-output=<OUTPUT_FILE_PATH>`

Save test output in JSON format directly to the specified file, regardless of whether or not you use the `--json` option.

This is especially useful if you want to display the human-readable test output using stdout and at the same time save the JSON format output to a file.

### `--sarif`

Return results in SARIF format. Note this requires the test to be run with `--file` as well.

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

Save test output in SARIF format directly to the `<OUTPUT_FILE_PATH>` file, regardless of whether or not you use the `--sarif` option.

This is especially useful if you want to display the human-readable test output using stdout and at the same time save the SARIF format output to a file.

### `--project-environment=<ENVIRONMENT>[,<ENVIRONMENT>]...>`

Set the project environment to one or more values (comma-separated). To clear the project environment set `--project-environment=`. Allowed values: frontend, backend, internal, external, mobile, saas, onprem, hosted, distributed

### `--project-lifecycle=<LIFECYCLE>[,<LIFECYCLE]...>`

Set the project lifecycle to one or more values (comma-separated). To clear the project lifecycle set `--project-lifecycle=`. Allowed values: production, development, sandbox

### `--project-business-criticality=<BUSINESS_CRITICALITY>[,<BUSINESS_CRITICALITY>]...>`

Set the project business criticality to one or more values (comma-separated). To clear the project business criticality set `--project-business-criticality=`. Allowed values: critical, medium, low

### `--project-tags=<TAG>[,<TAG>]...>`

Set the project tags to one or more values (comma-separarted key values pairs with an "=" separator), for example, `--project-tags=department=finance,team=alpha`. To clear the project tags set `--project-tags=`

### `--tags=<TAG>[,<TAG>]...>`

This is an alias for `--project tags`.

### `--severity-threshold=<low|medium|high|critical>`

Report only vulnerabilities at the specified level or higher.

### `--app-vulns`

&#x20;Allow detection of vulnerabilities in your application dependencies from container images, as well as from the operating system, all in one single scan.

### `--nested-jars-depth`

When using `--app-vulns` use the `--nested-jars-depth` option to set how many levels of nested jars Snyk is to unpack. Depth must be a number.

### `--exclude-base-image-vulns`

Do not show vulnerabilities introduced only by the base image. Available when using `snyk container test` only.

### `--platform=<PLATFORM>`

For multi-architecture images, specify the platform to test.

Supported platforms are: `linux/amd64`, `linux/arm64`, `linux/riscv64`, `linux/ppc64le`, `linux/s390x`, `linux/386`, `linux/arm/v7`, or `linux/arm/v6`.

### `--username=<CONTAINER_REGISTRY_USERNAME>`

Specify a username to use when connecting to a container registry. This is ignored in favor of local Docker binary credentials when Docker is present.

### `--password=<CONTAINER_REGISTRY_PASSWORD>`

Specify a password to use when connecting to a container registry. This is ignored in favor of local Docker binary credentials when Docker is present.

## Examples for the container test command

### Scan and monitor Docker images

`$ snyk container test <image>`&#x20;

`$ snyk container monitor <image>`

### Option to get more information including base image remediation

`--file=path/to/Dockerfile`

### Scan a Docker image created using the given Dockerfile and with a specified policy path

`$ snyk container test app:latest --file=Dockerfile`

`$ snyk container test app:latest --file=Dockerfile --policy-path=path/to/.snyk`

For more information and examples see [Advanced Snyk Container CLI usage](https://docs.snyk.io/snyk-container/snyk-cli-for-container-security/advanced-snyk-container-cli-usage).
