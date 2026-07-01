# Redteam get

**Warning:** The `snyk redteam get` command is experimental. The `--experimental` flag is required. Behavior and options may change in future releases without notice.

`snyk redteam` will be deprecated on May 31, 2026.

## Prerequisites

- Snyk CLI v1.1303.1 or later.
- Authenticated Snyk CLI; run `snyk auth`.

## Usage

`snyk redteam get --experimental --id=<SCAN_ID> [<OPTIONS>]`

## Description

The `snyk redteam get` command retrieves results for a previously completed red team scan.

For more information about red team scans and configuration, see the [`snyk redteam` help](redteam.md); `snyk redteam --help`.

## Options

### `--experimental`

Required. Acknowledges that this command is experimental.

### `--id=<SCAN_ID>`

Required. The UUID of the scan to retrieve results for.

### `--html`

Output the scan report in HTML format instead of JSON.

### `--html-file-output=<FILE_PATH>`

Write the HTML report to the specified file path. Implies HTML output.

### `--json-file-output=<FILE_PATH>`

Write the JSON report to the specified file path.

### `--tenant-id=<UUID>`

Specify the Snyk tenant ID. The CLI attempts to discover the tenant ID from your authenticated Snyk account if it is not provided.

## Example

Retrieve scan results:

`$ snyk redteam get --experimental --id=<SCAN_ID>`
