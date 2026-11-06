---
description: Use snyk cos target dump to export a target as YAML.
---

# COS target dump

## Usage

`snyk cos target dump [<OPTIONS>]`

## Description

The `snyk cos target dump` command exports a target as apply-compatible YAML.

Use this command to capture the configuration of an existing target, then reuse the exported file with [`snyk cos target add`](cos-target-add.md) to recreate the target.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: configuration file created successfully\
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
$ snyk cos target dump --target-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--output-file=<FILE>`

Write the YAML to the specified file.

Example:

```bash
$ snyk cos target dump --target-id=92b10f07ec07c7b1b73305181398ccf5 --output-file=output.yaml
```
