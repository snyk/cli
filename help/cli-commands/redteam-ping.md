# Redteam ping

**Warning:** The `snyk redteam ping` command is experimental. The `--experimental` flag is required. Behavior and options may change in future releases without notice.

`snyk redteam` will be deprecated on May 31, 2026.

## Prerequisites

- Snyk CLI v1.1303.1 or later.
- Authenticated Snyk CLI; run `snyk auth`.

## Usage

`snyk redteam ping --experimental [<OPTIONS>]`

## Description

The `snyk redteam ping` command sends a test request to the configured target endpoint.

Use this command to verify target connectivity and response parsing before running a full red team scan.

For more information about red team configuration, see the [`snyk redteam` help](redteam.md); `snyk redteam --help`.

## Options

### `--experimental`

Required. Acknowledges that this command is experimental.

### `--config=<FILE_PATH>`

Path to the YAML configuration file.

Default: `redteam.yaml` in the current directory.

### `--target-url=<URL>`

URL of the target endpoint to test. Overrides `target.settings.url` from the configuration file.

### `--request-body-template=<TEMPLATE>`

JSON template for the HTTP request body sent to the target. Must contain the `{{prompt}}` placeholder.

### `--response-selector=<JMESPATH_EXPRESSION>`

JMESPath expression used to extract the AI response from the target's JSON response body.

### `--header=<"KEY: VALUE">`

HTTP header to include in requests to the target.

This flag is repeatable.

## Example

Ping the target from `redteam.yaml`:

`$ snyk redteam ping --experimental --config=redteam.yaml`
