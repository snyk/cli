# Fix

## Usage

`snyk fix [<PATH>] [<OPTIONS>]`

## Description

The `snyk fix` command applies available fixes for open-source vulnerabilities in supported projects.

The command first runs `snyk test` for the target project and then applies supported remediation actions.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--dry-run`

Preview the fixes that would be applied without changing files.

### `--quiet`

Reduce command output.

### `--sequential`

Apply fixes sequentially.

### Options used by `snyk test`

The `snyk fix` command uses `snyk test` to find vulnerabilities before applying fixes. Supported `snyk test` options can be used to control project detection and dependency resolution.

For more information, see the [`snyk test` help](test.md); `snyk test --help`.

## Examples

Preview available fixes:

`$ snyk fix --dry-run`

Apply fixes in the current directory:

`$ snyk fix`
