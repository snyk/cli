---
description: Use snyk cos scan cancel to cancel a running scan.
---

# COS scan cancel

## Usage

`snyk cos scan cancel [<OPTIONS>]`

## Description

The `snyk cos scan cancel` command cancels a running scan. Snyk does not preserve findings confirmed before you cancel the scan.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: scan stopped\
**2**: failure, no scan is currently running on this target\
**3**: failure, target or scan ID not found

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
