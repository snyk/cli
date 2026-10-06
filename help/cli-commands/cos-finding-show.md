---
description: The snyk cos finding show command that shows the details of a finding.
---

# COS finding show

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Usage

`snyk cos finding show [<OPTIONS>]`

## Description

The `snyk cos finding show` command shows the details of a finding.

For a list of related commands see the [snyk cos](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: finding retrieved\
**3**: failure, finding ID not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--finding-id=<FINDING_ID>`

**Required**. Specify the finding whose details you want to show.

Example:

```bash
$ snyk cos finding show --finding-id=2394582049
```
