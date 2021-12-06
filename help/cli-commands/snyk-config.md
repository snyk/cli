# snyk config -- Manage Snyk CLI configuration

## Usage

`snyk config <COMMAND> [<OPTIONS>]`

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

### Flags available accross all commands

#### `--insecure`

Ignore unknown certificate authorities.

#### `-d`

Output debug logs.

#### `--quiet`, `-q`

Silence all output.

#### `--version`, `-v`

Prints versions.

#### `--help [<COMMAND>]`, `[<COMMAND>] --help`, `-h`

Prints a help text. You may specify a `<COMMAND>` to get more details.

## Environment

You can set these environment variables to change CLI settings.

### `SNYK_TOKEN`

Snyk authorization token. Setting this envvar will override the token that may be available in your `snyk config` settings.

[How to get your account token](https://snyk.co/ucT6J)<br />
[How to use Service Accounts](https://snyk.co/ucT6L)<br />

### `SNYK_CFG_KEY`

Allows you to override any key that's also available as `snyk config` option.

E.g. `SNYK_CFG_ORG=myorg` will override default org option in `config` with "myorg".

### `SNYK_REGISTRY_USERNAME`

Specify a username to use when connecting to a container registry. Note that using the `--username` flag will override this value. This will be ignored in favour of local Docker binary credentials when Docker is present.

### `SNYK_REGISTRY_PASSWORD`

Specify a password to use when connecting to a container registry. Note that using the `--password` flag will override this value. This will be ignored in favour of local Docker binary credentials when Docker is present.

### Connecting to Snyk API

By default Snyk CLI will connect to `https://snyk.io/api/v1`.

#### `SNYK_API`

Sets API host to use for Snyk requests. Useful for on-premise instances and configuring proxies. If set with `http` protocol CLI will upgrade the requests to `https`. Unless `SNYK_HTTP_PROTOCOL_UPGRADE` is set to `0`.

#### `SNYK_HTTP_PROTOCOL_UPGRADE=0`

If set to the value of `0`, API requests aimed at `http` URLs will not be upgraded to `https`. If not set, the default behavior will be to upgrade these requests from `http` to `https`. Useful e.g., for reverse proxies.

#### `HTTPS_PROXY` and `HTTP_PROXY`

Allows you to specify a proxy to use for `https` and `http` calls. The `https` in the `HTTPS_PROXY` means that _requests using `https` protocol_ will use this proxy. The proxy itself doesn't need to use `https`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulns found<br />
**1**: action_needed, vulns found<br />
**2**: failure, try to re-run command<br />
**3**: failure, no supported projects detected<br />
