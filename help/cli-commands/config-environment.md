# Config environment

**Note:** This command will be available as of CLI version 1.1293.0.

If you are not in the system default environment, SNYK-US-01, use the `snyk config environment` command to set your environment before you run `snyk auth`.

## Usage

`snyk config environment <ENVIRONMENT>`

## Description

The `snyk config environment` command is provided for your convenience to make changing the endpoint used in the CLI easier and safer.

The outcome is almost the same as `snyk config set endpoint=<URL>` but in addition, the `snyk config environment` command does the following:

- Supports aliases for environments to avoid the use of full URLs
- Performs basic checks to avoid ambiguous or unexpected configuration
- Clears existing authentication and organization settings, which are expected to be environment-specific

## Debug

Use the `-d` option to output the debug logs.

## Option

`--no-check`

Skip the basic checks for ambiguous or unexpected configuration.

Use only if the reported configuration issues are intentional and can be ignored. Otherwise, the configuration might not work as expected.

## Supported environment URLs mappings

- default => https://api.snyk.io&#x20;
- SNYK-US-01 => https://api.snyk.io&#x20;
- SNYK-US-02 => https://api.us.snyk.io&#x20;
- SNYK-AU-01 => https://api.au.snyk.io&#x20;
- SNYK-EU-01 => https://api.eu.snyk.io&#x20;
- SNYK-GOV-01 => https://api.snykgov.io

## Examples

```
snyk config environment default
snyk config environment SNYK-EU-01
snyk config environment SNYK-AU-01
snyk config environment SNYK-AU-01 --no-check
snyk config environment https://api.eu.snyk.io
```
