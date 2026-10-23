---
description: Use snyk cos scan status to view the current status of a scan.
---

# COS scan status

## Usage

`snyk cos scan status [<OPTIONS>]`

## Description

The `snyk cos scan status` command shows the current status of a scan.

Use the `--watch` option to poll until the scan reaches a terminal state.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: status retrieved\
**3**: failure, target ID not found or no scan exists for this target

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

Allowed values: `queued`, `completed`, `failed`, `canceled`

Example:

```bash
$ snyk cos scan status --scan-id=92b10f07ec07c7b1b73305181398ccf5 --watch
```

### `--json`

Print results on the console as a JSON data structure.

Example:

```bash
$ snyk cos scan status --scan-id=92b10f07ec07c7b1b73305181398ccf5 --json
```
