# Ignore create

## Usage

`snyk ignore create [<OPTIONS>]`

## Description

The `snyk ignore create` command creates an ignore request for a finding in a Snyk Organization.

This command creates an ignore request through the Snyk ignore workflow. It does not edit the local `.snyk` policy file. To add ignores to a local policy file, use the `snyk ignore` command.

In interactive mode, the command prompts for missing values. In non-interactive mode, provide the required options.

## Options

### `--finding-id=<FINDING_ID>`

The ID of the finding to ignore. Required when `--interactive=false`.

### `--ignore-type=<IGNORE_TYPE>`

The ignore type to create. Required when `--interactive=false`.

Supported values:

- `not-vulnerable`
- `wont-fix`
- `temporary-ignore`

### `--reason=<REASON>`

The reason for the ignore. Required when `--interactive=false`.

### `--expiration=<EXPIRATION>`

The ignore expiration date. Use `YYYY-MM-DD` format, or `never` for no expiration. Required when `--interactive=false`.

### `--remote-repo-url=<URL>`

The remote repository URL for the project. The command detects this value automatically when possible.

### `--interactive=<true|false>`

Run the command in interactive mode.

Default: `true`

### `--org=<ORG_ID>`

Specify the Snyk Organization ID to use for the ignore request. The value must be an Organization UUID.

## Examples

Create an ignore request interactively:

`$ snyk ignore create`

Create a temporary ignore request without prompts:

`$ snyk ignore create --finding-id=<FINDING_ID> --ignore-type=temporary-ignore --reason='Temporarily accepted risk' --expiration=2026-07-01 --interactive=false`
