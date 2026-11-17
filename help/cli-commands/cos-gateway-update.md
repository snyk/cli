# COS gateway update

## Usage

`snyk cos gateway update [<OPTIONS>]`

## Description

The `snyk cos gateway update` command updates a gateway.

For a sample configuration file you can copy and adapt, visit [COS target template](cos-target-template.md)

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: gateway updated successfully\
**3**: failure, configuration file not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--gateway-id=<GATEWAY_ID>`&#x20;

**Required**. Specify the ID of the gateway.

### `--name=<NAME>`

**Required**. Specify display name of the gateway.

Example:

```bash
$ snyk cos gateway update --gateway-id=<gateway-id> --name=dc4-singapore
```
