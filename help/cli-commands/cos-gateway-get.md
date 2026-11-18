# COS gateway get

## Usage

`snyk cos gateway get [<OPTIONS>]`

## Description

The `snyk cos gateway get` command shows the details of a gateway.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: gateway retrieved\
**3**: failure, finding ID not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--gateway-id=<GATEWAY_ID>`

**Required**. Specify the gateway whose details you want to show.

Example:

```bash
$ snyk cos gateway get --gateway-id=<gateway-id>
```
