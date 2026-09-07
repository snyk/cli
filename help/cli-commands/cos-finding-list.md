---
description: >-
  The snyk cos finding list command that lists the findings for a target or
  scan.
---

# COS finding list

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Usage

`snyk cos finding list [<OPTIONS>]`

## Description

The `snyk cos finding list` command lists the findings for a target or scan.

Use the `--target-id`, `--scan-id`, `--severity`, or `--state` options to filter the results.

For a list of related commands see the [snyk cos](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: findings retrieved\
**3**: failure, target ID or scan ID not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--target-id=<TARGET_ID>`

Specify the target whose findings you want to list.

Example:

```bash
$ snyk cos finding list --target-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--scan-id=<SCAN_ID>`

Scope the findings to the occurrences in a single scan.

Example:

```bash
$ snyk cos finding list --scan-id=f3a8c2d1-4b5e-6f7a-8b9c-0d1e2f3a4b5c
```

### `--severity=<SEVERITY>`

Filter the results by severity.

Allowed values: `critical`, `high`, `medium`, `low`

Example:

```bash
$ snyk cos finding list --target-id=92b10f07ec07c7b1b73305181398ccf5 --severity=critical
```

### `--state=<STATE>`

Filter the results by lifecycle state.

Allowed values: `open`, `fixed`

Example:

```bash
$ snyk cos finding list --target-id=92b10f07ec07c7b1b73305181398ccf5 --state=open
```

### `--limit=<LIMIT>`

Specify the maximum number of findings to return. Set to `0` to return all findings.

Default: `0`

Example:

```bash
$ snyk cos finding list --target-id=92b10f07ec07c7b1b73305181398ccf5 --limit=20
```

### `--output=<FORMAT>`, `-o <FORMAT>`

Specify the output format.

Allowed values: `table`, `json`, `yaml`, `ids`

Default: `table`

Example:

```bash
$ snyk cos finding list --target-id=92b10f07ec07c7b1b73305181398ccf5 --output=json
```
