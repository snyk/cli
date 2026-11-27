# COS target update

## Usage

`snyk cos target update [<OPTIONS>]`

## Description

The `snyk cos target update` command updates a target from a YAML configuration file.

For a sample configuration file you can copy and adapt, visit [COS target template](cos-target-template.md)

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: target updated successfully\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--target-id=<TARGET_ID>`

**Required**. Specify the ID of the target.

### `--config=<CONFIG>`

**Required**. Specify the path to the target YAML configuration file.

Example:

```bash
$ snyk cos target update --target-id=<target_id> --config=acme.yaml
```

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
