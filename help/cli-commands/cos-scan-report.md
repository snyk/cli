# COS scan report

## Usage

`snyk cos scan report [<OPTIONS>]`

## Description

The `snyk cos scan report` command returns the report for a completed scan. By default, the command prints the JSON report to stdout, or writes it to a file with `--output-file`. To download the PDF report, pass `-o pdf`. The command always writes the PDF report to a file: the `--output-file` path, or `penetration_test_report.pdf` by default.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: report downloaded\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--scan-id=<SCAN_ID>`

**Required**. Specify the scan whose report you want to return.

Example:

```bash
$ snyk cos scan report --scan-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--output=<FORMAT>`, `-o <FORMAT>`

Specify the report format.

Allowed values: `json`, `pdf`

Default: `json`

Example:

```bash
$ snyk cos scan report --scan-id=92b10f07ec07c7b1b73305181398ccf5 --output=pdf
```

### `--json`

Output JSON. Shorthand for `--output=json`.

### `--output-file=<FILE_PATH>`

Write the report to the specified file path. For `pdf`, defaults to `penetration_test_report.pdf` when omitted.

Example:

```bash
$ snyk cos scan report --scan-id=92b10f07ec07c7b1b73305181398ccf5 --output-file=./report.json
```

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
