# COS gateway delete

## Usage

`snyk cos gateway delete [<OPTIONS>]`

## Description

The `snyk cos gateway delete` command deletes a gateway and revokes its node token. The command prompts for confirmation unless you pass `--yes`.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, gateway successfully deleted\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--gateway-id=<GATEWAY_ID>`

**Required**. Specify the ID of the gateway.

Example:

```bash
$ snyk cos gateway delete --gateway-id=<gateway-id>
```

### `--yes`, `-y`

Skip the confirmation prompt.

Example:

```bash
$ snyk cos gateway delete --gateway-id=<gateway-id> --yes
```

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
