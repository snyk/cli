# snyk container -- Test container images for vulnerabilitie

## Usage

`snyk container [<COMMAND>] [<OPTIONS>] [<IMAGE>]`

## Description

Find vulnerabilities in your container images.

## Commands

### `test`

Test for any known vulnerabilities.

### `monitor`

Record the state of dependencies and any vulnerabilities on snyk.io.

## Options

### `--exclude-base-image-vulns`

Exclude from display base image vulnerabilities.

### `--file=<FILE_PATH>`

Include the path to the image's Dockerfile for more detailed advice.

### `--platform=<PLATFORM>`

For multi-architecture images, specify the platform to test.
[linux/amd64, linux/arm64, linux/riscv64, linux/ppc64le, linux/s390x, linux/386, linux/arm/v7 or linux/arm/v6]

### `--json`

Prints results in JSON format.

### `--json-file-output=<OUTPUT_FILE_PATH>`

(only in `test` command)
Save test output in JSON format directly to the specified file, regardless of whether or not you use the `--json` option.
This is especially useful if you want to display the human-readable test output via stdout and at the same time save the JSON format output to a file.

### `--sarif`

Return results in SARIF format.

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

(only in `test` command)
Save test output in SARIF format directly to the `<OUTPUT_FILE_PATH>` file, regardless of whether or not you use the `--sarif` option.
This is especially useful if you want to display the human-readable test output via stdout and at the same time save the SARIF format output to a file.

### `--print-deps`

Print the dependency tree before sending it for analysis.

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a snyk policy file.

### `--severity-threshold=low|medium|high|critical`

Only report vulnerabilities of provided level or higher.

### `--username=<CONTAINER_REGISTRY_USERNAME>`

Specify a username to use when connecting to a container registry. This will be ignored in favour of local Docker binary credentials when Docker is present.

### `--password=<CONTAINER_REGISTRY_PASSWORD>`

Specify a password to use when connecting to a container registry. This will be ignored in favour of local Docker binary credentials when Docker is present.
