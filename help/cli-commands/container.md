# snyk container -- test container images for vulnerabilities

## Usage

`snyk container <COMMAND> [<OPTIONS>] [<IMAGE>]`

## Description

The `snyk container` command finds vulnerabilities in container images.

For more information see [Snyk CLI for container security](https://docs.snyk.io/products/snyk-container/snyk-cli-for-container-security).

## Commands

### `test`

Test for any known vulnerabilities.

### `monitor`

Capture the container image layers and dependencies and monitor for vulnerabilities on snyk.io

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulnerabilities found<br />
**1**: action_needed, vulnerabilities found<br />
**2**: failure, try to re-run command<br />
**3**: failure, no supported projects detected<br />

## Congifure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. There are environment variables that apply to the container command. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--print-deps`

Print the dependency tree before sending it for analysis.

### `--file=<FILE_PATH>`

For more detailed advice, include the path to the Dockerfile for the image.

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results in JSON format.

### `--json-file-output=<OUTPUT_FILE_PATH>`

Save test output in JSON format directly to the specified file, regardless of whether or not you use the `--json` option.

This is especially useful if you want to display the human-readable test output using stdout and at the same time save the JSON format output to a file.

### `--sarif`

Return results in SARIF format.

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

Save test output in SARIF format directly to the `<OUTPUT_FILE_PATH>` file, regardless of whether or not you use the `--sarif` option.

This is especially useful if you want to display the human-readable test output using stdout and at the same time save the SARIF format output to a file.

### `--severity-threshold=low|medium|high|critical`

Report only vulnerabilities at the specified level or higher.

### `--exclude-base-image-vulns`

Exclude base image vulnerabilities from display.

### `--platform=<PLATFORM>`

For multi-architecture images, specify the platform to test.

Supported platforms are: `linux/amd64`, `linux/arm64`, `linux/riscv64`, `linux/ppc64le`, `linux/s390x`, `linux/386`, `linux/arm/v7`, or `linux/arm/v6`.

### `--username=<CONTAINER_REGISTRY_USERNAME>`

Specify a username to use when connecting to a container registry. This is ignored in favor of local Docker binary credentials when Docker is present.

### `--password=<CONTAINER_REGISTRY_PASSWORD>`

Specify a password to use when connecting to a container registry. This is ignored in favor of local Docker binary credentials when Docker is present.
