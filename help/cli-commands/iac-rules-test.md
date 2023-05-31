# IaC rules test

## Usage

**Feature availability:** This feature is in beta.

`snyk iac rules test [<OPTIONS>]`

## Description

The `snyk iac rules test` command runs all the tests written in Rego.

For a list of related commands run `snyk iac --help`

## Configure the Snyk CLI

You can use environment variables and set variables for connecting with the Snyk API; see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

See also subsequent sections for options for specific build environments, package managers, languages, and `[<CONTEXT-SPECIFIC OPTIONS>]` which you specify last.

### `--update-expected`

Overwrite the expected spec files to ensure that the test passes in the next run. This assumes that the tests were written correctly.

## Example for snyk iac rules test command

**Run tests for all rules**

```
snyk iac rules test
```
