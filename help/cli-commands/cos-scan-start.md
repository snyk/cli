---
description: The snyk cos scan start command that starts a new scan on a target.
---

# COS scan start

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Usage

`snyk cos scan start [<OPTIONS>]`

## Description

The `snyk cos scan start` command starts a new scan on a target. By default, the command returns immediately after starting the scan.

Use the `--wait` option to block until the scan finishes and print the report.

For a list of related commands see the [snyk cos](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: scan started\
**2**: failure, the target already has a running scan, the target is unreachable, or authentication failed\
**3**: failure, target ID not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

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

Wait for the scan to complete and print the report. When set, the command blocks until the scan finishes or the `--timeout` value is reached.

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5 --wait
```

### `--timeout=<DURATION>`

Specify the maximum time to wait when `--wait` is set. Use the format `<VALUE><UNIT>`, where unit is `s` (seconds), `m` (minutes), or `h` (hours), for example, `30s`, `5m`, or `1h`.

Default: `30m`

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5 --wait --timeout=60m
```

### `--interval=<DURATION>`

Specify the polling interval when `--wait` is set. Use the format `<VALUE><UNIT>`, where unit is `s` (seconds), `m` (minutes), or `h` (hours), for example, `30s`, `5m`, or `1h`.

Default: `5s`

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5 --wait --interval=10s
```

### `--json`

Print the report on the console as a JSON data structure. Requires `--wait`.

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5 --wait --json
```

### `--output-file=<FILE_PATH>`

Write the JSON report to the specified file path. Requires `--wait` and `--json`.

Example:

```bash
$ snyk cos scan start --target-id=92b10f07ec07c7b1b73305181398ccf5 --wait --json --output-file=./report.json
```
