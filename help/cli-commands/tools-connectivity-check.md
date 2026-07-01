# Tools connectivity-check

**Warning:** The `snyk tools connectivity-check` command is experimental. Behavior and options may change in future releases without notice.

## Usage

`snyk tools connectivity-check --experimental [<OPTIONS>]`

## Description

The `snyk tools connectivity-check` command runs diagnostic checks for Snyk CLI network connectivity.

Use this command to help troubleshoot access to Snyk API endpoints, Organization data, and related network dependencies.

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--experimental`

Required. Acknowledges that this command is experimental.

### `--json`

Output results in JSON format.

### `--no-color`

Disable colored output.

### `--timeout=<SECONDS>`

Timeout in seconds for each connection test.

Default: `10`

### `--max-org-count=<NUMBER>`

Maximum number of Organizations to retrieve during connectivity checks.

Default: `100`

## Example

Run connectivity diagnostics:

`$ snyk tools connectivity-check --experimental`
