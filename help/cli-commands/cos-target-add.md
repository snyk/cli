---
description: >-
  The snyk cos target add command that creates a target from a configuration
  file.
---

# COS target add

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Usage

`snyk cos target add [<OPTIONS>]`

## Description

The `snyk cos target add` command creates a target from a YAML configuration file.

For a sample configuration file you can copy and adapt, see [COS target template](cos-target-template.md)

For a list of related commands see the [snyk cos](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: target created successfully\
**2**: failure, primary URL unreachable\
**3**: failure, configuration file not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--config=<CONFIG>`

**Required**. Specify the path to the target YAML configuration file.

Example:

```bash
$ snyk cos target add --config=acme.yaml
```
