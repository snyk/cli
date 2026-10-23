---
description: Use snyk cos target show to view the details of a target.
---

# COS target show

## Usage

`snyk cos target show [<OPTIONS>]`

## Description

The `snyk cos target show` command shows the details of a target.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, target details retrieved\
**3**: failure, target ID not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--target-id=<TARGET_ID>`

**Required**. Specify the ID of the target.

Example:

```bash
$ snyk cos target show --target-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--output=<FORMAT>`, `-o <FORMAT>`

Specify the output format.

Allowed values: `table`, `json`, `yaml`, `ids`

Default: `table`

Example:

```bash
$ snyk cos target show --target-id=92b10f07ec07c7b1b73305181398ccf5 --output=json
```
