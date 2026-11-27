# COS scan cancel

## Usage

`snyk cos scan cancel [<OPTIONS>]`

## Description

The `snyk cos scan cancel` command cancels a scan addressed by `--scan-id`. The command fails if the scan is already in a terminal state (`completed`, `failed`, or `canceled`).

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: scan canceled\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--scan-id=<SCAN_ID>`

**Required**. Specify the scan to cancel. The `<SCAN_ID>` must be a valid scan ID.

Example:

```bash
$ snyk cos scan cancel --scan-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
