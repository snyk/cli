# snyk ignore -- modify the .snyk policy to ignore stated issues

## Usage

`snyk ignore --id=<ISSUE_ID> [--expiry=<EXPIRY>] [--reason=<REASON>] [<OPTIONS>]`

## Description

The `snyk ignore` command modifies the `.snyk` policy file to ignore a certain issue, according to its snyk ID for all occurrences. This updates your local `.snyk` file to contain a block similar to the following:

```yaml
ignore:
  '<ISSUE_ID>':
    - '*':
        reason: <REASON>
        expires: <EXPIRY>
```

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--id=<ISSUE_ID>`

Snyk ID for the issue to ignore. Required.

### `--expiry=<EXPIRY>`

Expiry date in a format `YYYY-MM-DD` ([ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) and [RFC 2822](https://tools.ietf.org/html/rfc2822) are supported).

### `--reason=<REASON>`

Human-readable `<REASON>` to ignore this issue.

## Example: ignore a specific vulnerability

`$ snyk ignore --id='npm:qs:20170213' --expiry='2021-01-10' --reason='Module not affected by this vulnerability'`
