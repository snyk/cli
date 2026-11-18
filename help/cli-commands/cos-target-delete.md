# COS target delete

## Usage

`snyk cos target delete [<OPTIONS>]`

## Description

The `snyk cos target delete` command deletes a target.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, target successfully deleted \
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
$ snyk cos target delete --target-id=92b10f07ec07c7b1b73305181398ccf5
```
