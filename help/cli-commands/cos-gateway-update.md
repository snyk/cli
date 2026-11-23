# COS gateway update

## Usage

`snyk cos gateway update [<OPTIONS>]`

## Description

The `snyk cos gateway update` command renames a gateway. You can change only the name.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: gateway updated successfully\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--gateway-id=<GATEWAY_ID>`

**Required**. Specify the ID of the gateway.

### `--name=<NAME>`

**Required**. Specify the display name of the gateway.

Example:

```bash
$ snyk cos gateway update --gateway-id=<gateway-id> --name=dc4-singapore
```

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
