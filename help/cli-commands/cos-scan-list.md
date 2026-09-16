---
description: The snyk cos scan list command that lists scans and their statuses.
---

# COS scan list

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Usage

`snyk cos scan list [<OPTIONS>]`

## Description

The `snyk cos scan list` command lists scans and their statuses.

Use the `--target-id`, `--status`, or `--since` options to filter the results.

For a list of related commands see the [snyk cos](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: scans retrieved\
**3**: failure, target ID not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--target-id=<TARGET_ID>`

Filter the results for a single target.

Example:

```bash
$ snyk cos scan list --target-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--status=<STATE>`

Filter the results by scan status.

Allowed values: `queued`, `running`, `completed`, `failed`, `canceled`

Example:

```bash
$ snyk cos scan list --status=completed
```

### `--since=<DURATION>`

Return only the scans created within this window. Use the format `<VALUE><UNIT>`, where unit is `m` (minutes), `h` (hours), or `d` (days), for example, `30m`, `24h`, or `7d`.

Example:

```bash
$ snyk cos scan list --since=24h
```

### `--limit=<LIMIT>`

Specify the maximum number of scans to return. Set to `0` to return all scans.

Default: `0`

Example:

```bash
$ snyk cos scan list --limit=10
```

### `--output=<FORMAT>`, `-o <FORMAT>`

Specify the output format.

Allowed values: `table`, `json`, `yaml`, `ids`

Default: `table`

Example:

```bash
$ snyk cos scan list --output=json
```
