# snyk-config(1) -- Manage Snyk CLI configuration

## SYNOPSIS

`snyk` `config` `get|set|clear` \[<KEY>\[=<VALUE>\]\] \[<OPTIONS>\]

## DESCRIPTION

Manage your local Snyk CLI config file. This config file is a JSON located at `$XDG_CONFIG_HOME` or `~/.config` followed by `configstore/snyk.json`. For example `~/.config/configstore/snyk.json`.

This command does not manage the `.snyk` file that's part of your project. See `snyk policy`, `snyk ignore` or `snyk wizard`.

## COMMANDS

- `get` <KEY>:
  Print a config value.

- `set` <KEY>=<VALUE>:
  Create a new config value.

- `unset` <KEY>:
  Remove a config value.

- `clear`:
  Remove all config values.

## OPTIONS

### Supported <KEY> values

- `api`:
  API token to use when calling Snyk API.

- `endpoint`:
  Defines the API endpoint to use.

- `disable-analytics`:
  Turns off analytics reporting.
