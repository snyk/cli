# snyk ignore -- Modifies the .snyk policy to ignore stated issues

## Usage

`snyk ignore --id=<ISSUE_ID> [--expiry=<EXPIRY>] [--reason=<REASON>] [<OPTIONS>]`

## Description

Ignore a certain issue, according to its snyk ID for all occurrences. This will update your local `.snyk` to contain a similar block:

```yaml
ignore:
  '<ISSUE_ID>':
    - '*':
        reason: <REASON>
        expires: <EXPIRY>
```

## Options

### `--id`=<ISSUE_ID>`

Snyk ID for the issue to ignore. Required.

### `--expiry=<EXPIRY>`

Expiry date, according to [RFC2822](https://tools.ietf.org/html/rfc2822)

### `--reason=<REASON>`

Human-readable <REASON> to ignore this issue.
