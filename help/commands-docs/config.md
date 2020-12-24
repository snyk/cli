# snyk-config(1) -- Manage Snyk CLI configuration

## SYNOPSIS

`snyk` `config` `get|set|clear` \[&lt;KEY&gt;\[=&lt;VALUE&gt;\]\] \[&lt;OPTIONS&gt;\]

## DESCRIPTION

Manage your local Snyk CLI config file.

This command does not manage the `.snyk` file that's part of your project. See `snyk policy`, `snyk ignore` or `snyk wizard`.

## COMMANDS

- `get` &lt;KEY&gt;:
  Print a config value.

- `set` &lt;KEY&gt;=&lt;VALUE&gt;:
  Create a new config value.

- `unset` &lt;KEY&gt;:
  Remove a config value.

- `clear`:
  Remove all config values.

## OPTIONS

### Supported &lt;KEY&gt; values

- `api`:
  API token to use when calling Snyk API.

- `endpoint`:
  Defines the API endpoint to use.

- `disable-analytics`:
  Turns off analytics reporting.
