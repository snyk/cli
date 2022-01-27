# snyk code -- find security issues using static code analysis

## Usage

`snyk code [<COMMAND>] [<OPTIONS>] [<PATH>]`

## Description

The `snyk code` command finds security issues using Static Code Analysis.

For more information see [CLI for Snyk Code](https://docs.snyk.io/snyk-code/cli-for-snyk-code).

## Command: `test`

Test for any known issue.

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulnerabilities found<br />
**1**: action_needed, vulnerabilities found<br />
**2**: failure, try to re-run command<br />
**3**: failure, no supported projects detected<br />

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--org=<ORG_NAME>`

Specify the `<ORG_NAME>`to run Snyk commands tied to a specific organization. The `<ORG_NAME>` influences private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_NAME>`

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_NAME>` option.

Default: `<ORG_NAME>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account).

### `--json`

Print results in JSON format.

### `--sarif`

Return results in SARIF format.

## `--no-markdown`

Removes the `markdown` field from the `result.message` object. Should be used when using `--sarif`.

### `--severity-threshold=low|medium|high|critical`

Report only vulnerabilities at the specified level or higher. Note that the Snyk Code configuration issues do not currently use the `critical` severity level.
