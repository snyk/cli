# COS target delete

## Usage

`snyk cos target delete [<OPTIONS>]`

## Description

The `snyk cos target delete` command deletes a target. The command prompts for confirmation unless you pass `--yes`. In a non-interactive shell, pass `--yes`.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, target successfully deleted\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

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

### `--yes`, `-y`

Skip the confirmation prompt.

Example:

```bash
$ snyk cos target delete --target-id=92b10f07ec07c7b1b73305181398ccf5 --yes
```

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
