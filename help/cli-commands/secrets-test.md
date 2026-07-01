# Secrets test

## Usage

`snyk secrets test [<PATH>] [<OPTIONS>]`

## Description

The `snyk secrets test` command scans a local path for secrets and reports discovered issues.

If you do not provide a path, the command scans the current directory.

## Exit codes

Possible exit codes and their meaning:

**0**: success, no issues found\
**1**: action_needed, issues found\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--json`

Print results on the console as a JSON data structure.

### `--sarif`

Return results in SARIF format.

### `--json-file-output=<FILE_PATH>`

Save test output as a JSON data structure directly to the specified file, regardless of whether or not you use the `--json` option.

### `--sarif-file-output=<FILE_PATH>`

Save test output in SARIF format directly to the specified file, regardless of whether or not you use the `--sarif` option.

### `--severity-threshold=<low|medium|high|critical>`

Report only issues at the specified level or higher.

### `--include-ignores`

Show all discovered issues, including issues that have been previously ignored.

### `--exclude=<NAME>[,<NAME>...]`

Ignore issues originating from the specified file or directory names.

The value must be a comma-separated list of names and cannot contain paths.

### `--report`

Share results with the Snyk Web UI.

### `--remote-repo-url=<URL>`

Set or override the remote URL for the repository.

### `--target-name=<TARGET_NAME>`

Used with `--report` to set or override the project name for the repository.

### `--target-reference=<REFERENCE>`

Used with `--report` to specify a reference that differentiates this project, for example a branch name or version.

### `--project-business-criticality=<VALUE>[,<VALUE>...]`

Used with `--report` to set the project business criticality.

Supported values: `critical`, `high`, `medium`, `low`.

### `--project-environment=<VALUE>[,<VALUE>...]`

Used with `--report` to set the project environment.

Supported values: `frontend`, `backend`, `internal`, `external`, `mobile`, `saas`, `onprem`, `hosted`, `distributed`.

### `--project-lifecycle=<VALUE>[,<VALUE>...]`

Used with `--report` to set the project lifecycle.

Supported values: `production`, `development`, `sandbox`.

### `--project-tags=<KEY=VALUE>[,<KEY=VALUE>...]`

Used with `--report` to set project tags.

## Examples

Scan the current directory:

`$ snyk secrets test`

Scan a specific directory and output SARIF:

`$ snyk secrets test ./src --sarif-file-output=secrets.sarif`

Share results with project attributes:

`$ snyk secrets test --report --target-reference=main --project-lifecycle=production`
