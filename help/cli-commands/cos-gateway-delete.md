# COS gateway delete

## Usage

`snyk cos gateway delete [<OPTIONS>]`

## Description

The `snyk cos gateway delete` command deletes a gateway.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, gateway successfully deleted\
**3**: failure, target ID not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--gateway-id=<GATEWAY_UID>`

**Required**. Specify the ID of the gateway.

Example:

```bash
$ snyk cos gateway delete --gateway-id=<gateway-id>
```
