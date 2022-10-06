# Container test

## Usage

`snyk container test [<OPTIONS>] [<IMAGE>]`

## Description

The `snyk container test` command tests container images for any known vulnerabilities.

For more information see [Snyk CLI for container security](https://docs.snyk.io/products/snyk-container/snyk-cli-for-container-security)

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulnerabilities found\
**1**: action_needed, vulnerabilities found\
**2**: failure, try to re-run command\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API.

There are environment variables that apply to the container command; see [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli)

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

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

Note that you can also use `--org=<orgslugname>`. The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://docs.snyk.io/snyk-cli/test-for-vulnerabilities/how-to-select-the-organization-to-use-in-the-cli)

### `--file=<FILE_PATH>`

For more detailed advice, include the path to the Dockerfile for the image.

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results ion the console as a JSON data structure.

Example: `$ snyk container test --json`

### `--json-file-output=<OUTPUT_FILE_PATH>`

Save test output in JSON format as a JSON data structure directly to the specified file, regardless of whether or not you use the `--json` option.

Use to display the human-readable test output using stdout and at the same time save the JSON data structure output to a file. If no issues are found, an output file is not created.

Example: `$ snyk container test --json-file-output=vuln.json`

### `--sarif`

Return results in SARIF format. Note this requires the test to be run with `--file` as well.

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

Save test output in SARIF format directly to the `<OUTPUT_FILE_PATH>` file, regardless of whether or not you use the `--sarif` option.

This is especially useful if you want to display the human-readable test output using stdout and at the same time save the SARIF format output to a file.

### `--severity-threshold=<low|medium|high|critical>`

Report only vulnerabilities at the specified level or higher.

### `--fail-on=<all|upgradable>`

Fail only when there are vulnerabilities that can be fixed.

- `all`: fail when there is at least one vulnerability that can be either upgraded or patched.
- `upgradable`: fail when there is at least one vulnerability that can be upgraded.

To fail on any vulnerability (the default behavior), do not use the `--fail-on` option. If vulnerabilities do not have a fix and this option is being used, tests pass.

### `--app-vulns`

Allow detection of vulnerabilities in your application dependencies from container images, as well as from the operating system, all in one single scan.

In CLI version 1.962.0 and higher, use the `--app-vulns` option with the the `--json` option to see the operating system as well as application vulnerabilities in JSON format in the results.

For more information see [Detecting application vulnerabilities in container images](https://docs.snyk.io/products/snyk-container/getting-around-the-snyk-container-ui/detecting-application-vulnerabilities-in-container-images)

### `--exclude-app-vulns`

Allow disabling scans for app vulnerabilities in advance of `app-vulns` being enabled by default.

Cannot be used with`--app-vulns`.

For more information see [Detecting application vulnerabilities in container images](https://docs.snyk.io/products/snyk-container/getting-around-the-snyk-container-ui/detecting-application-vulnerabilities-in-container-images)

### `--nested-jars-depth`

When using `--app-vulns` use the `--nested-jars-depth` option to set how many levels of nested jars Snyk is to unpack. Depth must be a number.

### `--exclude-base-image-vulns`

Do not show vulnerabilities introduced only by the base image. Available when using `snyk container test` only.

### `--platform=<PLATFORM>`

For multi-architecture images, specify the platform to test.

Supported platforms are: `linux/amd64`, `linux/arm64`, `linux/riscv64`, `linux/ppc64le`, `linux/s390x`, `linux/386`, `linux/arm/v7`, or `linux/arm/v6`

### `--username=<CONTAINER_REGISTRY_USERNAME>`

Specify a username to use when connecting to a container registry. This is ignored in favor of local Docker binary credentials when Docker is present.

### `--password=<CONTAINER_REGISTRY_PASSWORD>`

Specify a password to use when connecting to a container registry. This is ignored in favor of local Docker binary credentials when Docker is present.

## Examples for the container test command

### Scan Docker images

`$ snyk container test <image>`

### Option to get more information including base image remediation

`--file=path/to/Dockerfile`

### Scan a Docker image created using the given Dockerfile and with a specified policy path

`$ snyk container test app:latest --file=Dockerfile`

`$ snyk container test app:latest --file=Dockerfile --policy-path=path/to/.snyk`

For more information and examples see [Advanced Snyk Container CLI usage](https://docs.snyk.io/snyk-container/snyk-cli-for-container-security/advanced-snyk-container-cli-usage)
