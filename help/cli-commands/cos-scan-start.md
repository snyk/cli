# COS scan start

## Usage

`snyk cos scan start [<OPTIONS>]`

## Description

The `snyk cos scan start` command starts a new scan on a target. By default, the command returns immediately after starting the scan.

Use the `--wait` option to poll until the scan completes. With `--wait`, the command writes the report to stdout only when `--json` is also set, or to a file when `--output-file` is set. Otherwise it prints a summary, and you can fetch the report later with [`snyk cos scan report`](cos-scan-report.md).

`--wait` polls for up to 30 minutes. Interrupting it (Ctrl+C) or reaching that limit stops the waiting, not the scan.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: scan started\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--target-id=<TARGET_ID>`

**Required**. Specify the target to scan. The `<TARGET_ID>` must be a valid target ID.

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--wait`

Wait for the scan to complete. When set, the command blocks until the scan finishes or the 30-minute wait limit is reached.

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5 --wait
```

### `--interval=<DURATION>`

Specify the polling interval when `--wait` is set. Use the format `<VALUE><UNIT>`, where unit is `s` (seconds), `m` (minutes), or `h` (hours), for example, `30s`, `5m`, or `1h`.

Default: `5s`

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5 --wait --interval=10s
```

### `--json`

Output in JSON format. Without `--wait`, prints the created scan. With `--wait`, prints the report.

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5 --wait --json
```

### `--output-file=<FILE_PATH>`

Write the JSON report to the specified file path. Use with `--wait`. To fetch the report, set `--json` or `--output-file`. You do not need both.

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5 --wait --output-file=./report.json
```

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
