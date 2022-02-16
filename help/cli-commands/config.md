# Config

## Usage

`snyk config <COMMAND> [<OPTIONS>]`

## Description

The `snyk config` command manages your local Snyk CLI config file, a JSON file located at `$XDG_CONFIG_HOME` or `~/.config` followed by `configstore/snyk.json`, for example, `~/.config/configstore/snyk.json`.

This command does not manage the `.snyk` file that is part of your project. See the `snyk policy` and `snyk ignore` commands.

## Debug

Use the `-d` option to output the debug logs.

## Commands

### `get <KEY>`

Print a config value.

### `set <KEY>=<VALUE>`

Create a new config value.

### `unset <KEY>`

Remove a config value.

### `clear`

Remove all config values.

## Supported `<KEY>` values

### `api`

API token to use when calling Snyk API.

### `endpoint`

Define the API endpoint to use.

### `disable-analytics`

Turn off analytics reporting.

### `oci-registry-url`

Configure the OCI registry used in IaC scanning with custom rules.

### `oci-registry-username`

Configure the username for an OCI registry used in IaC scanning with custom rules.

### `oci-registry-password`

Configure the password for an OCI registry used in IaC scanning with custom rules.
