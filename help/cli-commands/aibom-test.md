# AI-BOM test

**Note**: AI-BOM is an experimental feature and is subject to breaking changes without notice. If you are using AI-BOM, Snyk recommends installing the Snyk CLI from the [release](../releases-and-channels-for-the-snyk-cli.md#stable) channel.

## Prerequisites

- The `snyk aibom test` feature requires an internet connection.
- Snyk CLI v1.1304.0 (or later).
- Your Snyk Organization must have Evo policies configured (for example, in the Evo web interface).

## Usage

`$ snyk aibom test --experimental [<OPTION>]`

## Description

The `snyk aibom test` command generates an AI-BOM for your local project and evaluates it against your tenant's Evo policies. It reports all policy violations as issues, so you can see which AI models, tools, or other components are disallowed or non-compliant.

The command:

1. **Generates an AI-BOM** for the current project (same behavior as [`snyk aibom`](aibom.md)), detecting AI models, agents, tools, and MCP dependencies.
2. **Runs a policy test** against the policies configured for your Organization.
3. **Returns all resulting issues**, grouped into **Open issues** (active policy violations) and **Ignored issues** (violations that are configured to be ignored).

For each issue, the output includes:

- **Severity** (LOW, MEDIUM, HIGH, CRITICAL)
- **Description** of the policy violation (for example, a disallowed model or asset)
- **Policy link** to view or edit the policy in the Evo web interface
- **Remediation advice** when the policy provides it

A **Test summary** at the end shows the total count of open and ignored issues by severity.

## Exit codes

Possible exit codes and their meaning:

**0**: success (scan completed), no open policy issues.\
**1**: action_needed (scan completed), one or more open policy issues found.\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.\
**3**: failure, unable to find any supported files for the scan.

## Debug

Use the `-d` or `--debug` option to output the debug logs.

## Options

### `--experimental`

**Required**. Use experimental command features. This option is required because the command is in its experimental phase.

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run the policy test against the policies of a specific Snyk Organization.

If you have multiple Organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested Projects are tested under your default Organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred Organization in your [Account settings](https://app.snyk.io/account)

## Example

```bash
snyk aibom test --experimental
```

This generates an AI-BOM for the current directory, runs the policy test for the current preferred Organization, and prints open issues, ignored issues, and the test summary.

### `--json-file-output=<OUTPUT_FILE_PATH>`

**Optional.** Write the policy test results to a JSON file at the given path instead of printing the report. The JSON includes full issue details and closed issues, which are not shown in the on-screen report.

Example: `$ snyk aibom test --experimental --json-file-output=results.json`

### `--severity-threshold=<low|medium|high|critical>`

**Optional.** Minimum severity that triggers `action_needed` (exit code 1). Only issues at or above this level cause the command to exit with 1. Default: `low`.
