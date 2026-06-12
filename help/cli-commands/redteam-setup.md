# Redteam setup

**Warning:** The `snyk redteam setup` command is experimental. The `--experimental` flag is required. Behavior and options may change in future releases without notice.

`snyk redteam` will be deprecated on May 31, 2026.

## Prerequisites

- Snyk CLI v1.1303.1 or later.
- Authenticated Snyk CLI; run `snyk auth`.

## Usage

`snyk redteam setup --experimental [<OPTIONS>]`

## Description

The `snyk redteam setup` command launches a local web-based setup wizard for red team target configuration.

The wizard guides you through target endpoint, header, goal, and strategy configuration, then produces a `redteam.yaml` file for `snyk redteam`.

For more information about red team scans and configuration, see the [`snyk redteam` help](redteam.md); `snyk redteam --help`.

## Options

### `--experimental`

Required. Acknowledges that this command is experimental.

### `--config=<FILE_PATH>`

Load an existing configuration file to edit.

Default: `redteam.yaml` in the current directory.

### `--port=<NUMBER>`

Port for the setup wizard's local web server.

Default: `8484`

## Example

Launch the setup wizard:

`$ snyk redteam setup --experimental`
