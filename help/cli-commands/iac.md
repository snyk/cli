# IAC

## Usage

`snyk iac <COMMAND> [<OPTIONS>] [<PATH>]`

## Description

The `snyk iac` command finds security issues in Infrastructure as Code files, and detects drift.

For more information see [Synk CLI for Infrastructure as Code](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code).

## Subcommands

### [`test`](iac-test.md)

Test for any known vulnerabilities.

### [`describe`](iac-describe.md)

Detect, track, and, alert on infrastructure drift and unmanaged resources.

### [`gen-driftignore`](iac-gen-driftignore.md)

Generate driftignore rules to be used by `snyk iac describe`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulnerabilities found\
**1**: action_needed, vulnerabilities found\
**2**: failure, try to re-run command\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. There are environment variables that apply to the container command.

See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.
