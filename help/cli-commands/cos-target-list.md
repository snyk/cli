---
description: Use snyk cos target list to list all targets.
---

# COS target list

## Usage

`snyk cos target list [<OPTIONS>]`

## Description

The `snyk cos target list` command lists all targets.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, targets retrieved\
**3**: failure, invalid arguments

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--output=<FORMAT>`, `-o <FORMAT>`

Specify the output format.

Allowed values: `table`, `json`, `yaml`, `ids`

Default: `table`

Example:

```bash
$ snyk cos target list --output=json
```
