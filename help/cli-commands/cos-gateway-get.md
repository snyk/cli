# COS gateway get

## Usage

`snyk cos gateway get [<OPTIONS>]`

## Description

The `snyk cos gateway get` command gets the details of a gateway.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: gateway retrieved\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--gateway-id=<GATEWAY_ID>`

**Required**. Specify the gateway whose details you want to get.

Example:

```bash
$ snyk cos gateway get --gateway-id=<gateway-id>
```

### `--output=<FORMAT>`, `-o <FORMAT>`

Specify the output format.

Allowed values: `table`, `json`, `yaml`, `ids`

Default: `table`

Example:

```bash
$ snyk cos gateway get --gateway-id=<gateway-id> --output=json
```

### `--json`

Output JSON. Shorthand for `--output=json`.

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
