# Secrets test

## Prerequisites

To use the `snyk secrets test` command:

- Install the latest version of the [Snyk CLI](../install-the-snyk-cli/)
- [Authenticate](auth.md) your machine with the Snyk CLI using `snyk auth`.
- Ensure the Secrets feature is enabled for your Organization. If you receive a `SNYK-CLI-0016` error, contact your Snyk account manager.

## Usage

`snyk secrets test [PATH]`

## Description

Scan your source code to identify and manage sensitive information such as API keys, passwords, and tokens. This command finds hardcoded secrets in your current directory or a specified path. The command always scans the targeted directory recursively.

## Exit codes

**0**: Success. No secrets found, or all found secrets are ignored.\
**1**: Action needed. Secrets found require attention.\
**2**: Failure. An error occurred.

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--exclude=<NAME>[,<NAME>]...`

Exclude directory names and file names from the scan. Provide a comma-separated list of names. Do not include a path. Example: `snyk secrets test --exclude=dir1,file2` This excludes any directories and files named `dir1` and `file2` from the secrets scan, such as `./dir1`, `./src/dir1`, `./file2`, and `./src/file2`.

### `--org=<ORG_ID>`

Specify the Snyk Organization to associate the test results with. Example: `snyk secrets test --org=<ORG_ID>`

### `--include-ignores`

Include ignored findings in the scan results. Use this option to audit your codebase and review suppressed items. Example: `snyk secrets test --include-ignores`

### `--severity-threshold=<low|medium|high|critical>`

Report only vulnerabilities at the specified level or higher. Allowed values: `low`, `medium`, `high`, `critical`.

### `--report`

Share results with the Snyk Web UI. This creates a project in your Snyk account with a snapshot of the current issues or appends the snapshot to an existing project. After using this option, log in to the Snyk website and view your projects to see the snapshot. When you use `--report`, enable the **View Project Ignores** permission for the service account or user token. Snyk requires this permission to access ignore information when you report results. If Snyk returns a `403 Forbidden` error, ensure your service account role includes this permission. Example: `snyk secrets test --report`

### `--target-name=<TARGET_NAME>`

Use this option in combination with the `--report` option. Set or override the target name for the project.

### `--target-reference=<TARGET_REFERENCE>`

Use this option in combination with the `--report` option. Specify a reference that differentiates this project, for example, a branch name or version. Projects with the same reference can be grouped based on that reference. Example of setting to the current Git branch:

`snyk secrets test --report --target-reference="$(git branch --show-current)"`

Example of setting to the latest Git tag:

`snyk secrets test --report --target-reference="$(git describe --tags --abbrev=0)"`

### `--project-environment=<ENVIRONMENT>[,<ENVIRONMENT>]...`

Set the project environment project attribute to one or more comma-separated values. To clear the project environment, set `--project-environment=`. Allowed values: `frontend`, `backend`, `internal`, `external`, `mobile`, `saas`, `onprem`, `hosted`, `distributed`. For more information, see [Project attributes](https://app.gitbook.com/s/BJO0IZx7zB6bOkotxQP2/scan-with-snyk/snyk-projects/project-attributes)

### `--project-lifecycle=<LIFECYCLE>[,<LIFECYCLE>]...`

Set the project lifecycle project attribute to one or more comma-separated values. To clear the project lifecycle, set `--project-lifecycle=`. Allowed values: `production`, `development`, `sandbox`. For more information, see [Project attributes](https://app.gitbook.com/s/BJO0IZx7zB6bOkotxQP2/scan-with-snyk/snyk-projects/project-attributes)

### `--project-business-criticality=<BUSINESS_CRITICALITY>[,<BUSINESS_CRITICALITY>]...`

Set the project business criticality project attribute to one or more comma-separated values. To clear the project business criticality, set `--project-business-criticality=`. Allowed values: `critical`, `high`, `medium`, `low`. For more information, see [Project attributes](https://app.gitbook.com/s/BJO0IZx7zB6bOkotxQP2/scan-with-snyk/snyk-projects/project-attributes)

### `--project-tags=<TAG>[,<TAG>]...`

Set the project tags to one or more comma-separated key-value pairs with an `=` separator. Example: `snyk secrets test --project-tags=department=finance,team=alpha` To clear the project tags, set `--project-tags=`. For more information, including allowable characters, see [Project tags](https://app.gitbook.com/s/BJO0IZx7zB6bOkotxQP2/scan-with-snyk/snyk-projects/project-tags)

### `--json`

Print results to the console as a JSON data structure. Example: `snyk secrets test --json`

### `--json-file-output=<OUTPUT_FILE_PATH>`

Save test output as a JSON data structure directly to the specified file, regardless of whether you use the `--json` option. Use this option to display human-readable test output using `stdout` and, at the same time, save the JSON data structure output to a file. For Secrets, Snyk does not create a JSON file if no issues are found. For open source, Snyk creates a file whether or not issues are found. Example: `snyk secrets test --json-file-output=detected-secrets.json`

### `--sarif`

Return results in SARIF format. Example: `snyk secrets test --sarif`

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

Save test output in SARIF format directly to the `<OUTPUT_FILE_PATH>` file, regardless of whether you use the `--sarif` option. Use this option to display human-readable test output using `stdout` and, at the same time, save the SARIF format output to a file. When running multiple scans, such as Secrets and Code scans, the SARIF output includes data only from the most recently completed scan. If you run multiple scans sequentially and specify the same `--sarif-file-output` file path, each subsequent scan overwrites the previous SARIF file. To keep results separate, save each scan to a different SARIF output file.
