# COS scan status

## Usage

`snyk cos scan status [<OPTIONS>]`

## Description

The `snyk cos scan status` command shows the current status of a scan, addressed by `--scan-id`.

Use the `--watch` option to poll until the scan reaches a terminal state. `--watch` polls for up to 30 minutes.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: status retrieved\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--scan-id=<SCAN_ID>`

**Required**. Specify the scan whose status you want to retrieve. The `<SCAN_ID>` must be a valid scan ID.

Example:

```bash
$ snyk cos scan status --scan-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--watch`

Poll until the scan reaches a terminal state.

Example:

```bash
$ snyk cos scan status --scan-id=92b10f07ec07c7b1b73305181398ccf5 --watch
```

### `--output=<FORMAT>`, `-o <FORMAT>`

Specify the output format.

Allowed values: `table`, `json`, `yaml`, `ids`

Default: `table`

Example:

```bash
$ snyk cos scan status --scan-id=92b10f07ec07c7b1b73305181398ccf5 --output=json
```

### `--json`

Output JSON. Shorthand for `--output=json`.

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
