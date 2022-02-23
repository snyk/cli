# snyk iac gen-driftignore -- generate ignore rules based on scan result

## Usage

`snyk iac gen-driftignore [<OPTIONS>]`

## Description

The `snyk iac gen-driftignore` can generate driftignore rules to be used by `snyk iac scan`.

For more information see the [driftctl documentation](https://docs.driftctl.com/).

## Exit codes

Possible exit codes and their meaning:

**0**: success, driftignore generated successfully
**1**: error, something wrong happened during ignore file generation

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API.
See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--input`

Input where the JSON should be parsed from. Defaults to stdin.

### `--output`

Output file path to write the driftignore to. (default ".driftignore")

### `--exclude-changed`

Exclude resources that changed on cloud provider

### `--exclude-missing`

Exclude missing resources

### `--exclude-unmanaged`

Exclude resources not managed by IaC

## Usage

```
$ snyk iac scan --output=json://output.json
$ snyk iac gen-driftignore --input=output.json --output=/dev/stdout
```
