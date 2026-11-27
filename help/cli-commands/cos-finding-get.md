# COS finding get

## Usage

`snyk cos finding get [<OPTIONS>]`

## Description

The `snyk cos finding get` command gets the details of a finding.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: finding retrieved\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--finding-id=<FINDING_ID>`

**Required**. Specify the finding whose details you want to get.

Example:

```bash
$ snyk cos finding get --finding-id=2394582049
```

### `--target-id=<TARGET_ID>`

Optional. Specify the target the finding belongs to. If you omit it, the command resolves the target from the finding.

Example:

```bash
$ snyk cos finding get --finding-id=2394582049 --target-id=92b10f07ec07c7b1b73305181398ccf5
```

### `--output=<FORMAT>`, `-o <FORMAT>`

Specify the output format.

Allowed values: `table`, `json`, `yaml`, `ids`

Default: `table`

Example:

```bash
$ snyk cos finding get --finding-id=2394582049 --output=json
```

### `--json`

Output JSON. Shorthand for `--output=json`.

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.
