---
description: The snyk cos scan status command that shows the current status of a scan.
---

# COS scan status

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Usage

`snyk cos scan status [<OPTIONS>]`

## Description

The `snyk cos scan status` command shows the current status of a scan.

Use the `--watch` option to poll until the scan reaches a terminal state.

For a list of related commands see the [snyk cos](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: status retrieved\
**3**: failure, target ID not found or no scan exists for this target

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

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
