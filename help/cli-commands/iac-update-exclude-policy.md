# snyk iac update-exclude-policy -- generate ignore rules based on scan result

## Usage

`snyk iac update-exclude-policy [<OPTIONS>]`

## Description

The `snyk iac update-exclude-policy` can generate exclude policy rules to be used by `snyk iac scan`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, exclude rules generated successfully
**1**: error, something wrong happened during exclude rules generation

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API.
See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--exclude-changed`

Exclude resources that changed on cloud provider

### `--exclude-missing`

Exclude missing resources

### `--exclude-unmanaged`

Exclude resources not managed by IaC

## Usage

```
$ snyk iac scan --output=json://output.json
$ snyk iac describe --json --all | snyk iac update-exclude-policy
```
