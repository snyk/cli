# snyk config -- Manage Snyk CLI configuration

## Usage

`snyk config get|set|unset|clear [<KEY>[=<VALUE>]] [<OPTIONS>]`

## Description

Manage your local Snyk CLI config file. This config file is a JSON located at `$XDG_CONFIG_HOME` or `~/.config` followed by `configstore/snyk.json`. For example `~/.config/configstore/snyk.json`.

This command does not manage the `.snyk` file that's part of your project. See `snyk policy`, `snyk ignore` or `snyk wizard`.

## Commands

### `get <KEY>`

Print a config value.

### `set <KEY>=<VALUE>`

Create a new config value.

### `unset <KEY>`

Remove a config value.

### `clear`

Remove all config values.

## Options

### Supported `<KEY>` values

#### `api`

API token to use when calling Snyk API.

#### `endpoint`

Defines the API endpoint to use.

#### `disable-analytics`

Turns off analytics reporting.

#### `oci-registry-url`

Configures the OCI registry used in IaC scannings with custom rules.

#### `oci-registry-username`

Configures the username for an OCI registry used in IaC scannings with custom rules.

#### `oci-registry-password`

Configures the password for an OCI registry used in IaC scannings with custom rules.
