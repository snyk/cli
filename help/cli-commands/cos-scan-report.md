---
description: The snyk cos scan report command that returns the report for a completed scan.
---

# COS scan report

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Usage

`snyk cos scan report [<OPTIONS>]`

## Description

The `snyk cos scan report` command returns the report for a completed scan.

For a list of related commands see the [snyk cos](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: report downloaded\
**2**: failure, report generation failed\
**3**: failure, scan ID not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--scan-id=<SCAN_ID>`

**Required**. Specify the scan whose report you want to return.

Example:

```bash
$ snyk cos scan report --scan-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--format=<FORMAT>`

Specify the report format.

Allowed values: `json`, `pdf`

Default: `json`

Example:

```bash
$ snyk cos scan report --scan-id=92b10f07ec07c7b1b73305181398ccf5 --format=pdf
```

### `--output-file=<FILE_PATH>`

Write the report to the specified file path.

Example:

```bash
$ snyk cos scan report --scan-id=92b10f07ec07c7b1b73305181398ccf5 --output-file=./report.json
```
