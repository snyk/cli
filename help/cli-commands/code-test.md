# Code test

## Usage

`snyk code test [<OPTIONS>] [<PATH>]`

## Description

The `snyk code test` command tests for any known security issues using Static Code Analysis.

For more information, see [Using Snyk Code from the CLI](https://docs.snyk.io/scan-applications/snyk-code/using-snyk-code-from-the-cli)

For instructions on ignoring issues with `snyk code test` see [Excluding directories and files from the Snyk Code CLI test](https://docs.snyk.io/scan-applications/snyk-code/using-snyk-code-from-the-cli/excluding-directories-and-files-from-the-snyk-code-cli-test)

## Exit codes

Possible exit codes and their meaning:

**0**: success (scan completed), no vulnerabilities found\
**1**: action_needed (scan completed), vulnerabilities found\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API; see [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--org=<ORG_ID>`

Specify the `<ORG_ID>`to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

Note that you can also use `--org=<orgslugname>`. The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information, see the article [How to select the organization to use in the CLI](https://docs.snyk.io/snyk-cli/test-for-vulnerabilities/how-to-select-the-organization-to-use-in-the-cli)

### `--report`

**NEW** option: Share results with the Snyk Web UI.

**Feature availability**: This feature is currently in Closed Beta. To obtain access, contact your Snyk account representative.

This creates a project in your Snyk account with a snapshot of the current configuration issues or appends the snapshot to an existing project.

After using this option, log in to the Snyk website and view your projects to see the snapshot.

Example: `$ snyk code test --report --project-name="PROJECT_NAME"`

For more information, see [Publishing CLI results to a Snyk Project](https://docs.snyk.io/scan-application-code/snyk-code/cli-for-snyk-code/publishing-cli-results-to-a-snyk-project-and-ignoring-cli-results#publishing-cli-results-to-a-snyk-project)

### `--json`

Print results on the console as a JSON data structure.

Example: `$ snyk code test --json`

### `--json-file-output=<OUTPUT_FILE_PATH>`

Save test output as a JSON data structure directly to the specified file, regardless of whether or not you use the `--json` option.

Use to display the human-readable test output using stdout and, at the same time, save the JSON data structure output to a file.

For SAST, if no issues are found, Snyk does not create a `json` file. In contrast, for open-source, Snyk creates a file whether or not issues are found.&#x20;

Example: `$ snyk code test --json-file-output=vuln.json`

### `--sarif`

Return results in SARIF format.

Example: `$ snyk code --sarif`

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

Save test output in SARIF format directly to the \<OUTPUT_FILE_PATH> file, regardless of whether or not you use the `--sarif` option.

Use to display the human-readable test output using stdout and, at the same time, save the SARIF format output to a file.

### `--severity-threshold=<low|medium|high>`

Report only vulnerabilities at the specified level or higher.

**Note**: The Snyk Code configuration issues do not use the `critical` severity level.
