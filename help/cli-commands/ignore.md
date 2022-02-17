# Ignore

## Usage

`snyk ignore --id=<ISSUE_ID> [--expiry=] [--reason=] [--policy-path=<PATH_TO_POLICY_FILE>] [--path=<PATH_TO_RESOURCE>] [OPTIONS]`

## Description

The `snyk ignore` command modifies the `.snyk` policy file to ignore a stated issue according to its snyk ID for all occurrences. This updates your local `.snyk` file to contain a block similar to the following:

```yaml
ignore:
  '<ISSUE_ID>':
    - '*':
        reason: <REASON>
        expires: <EXPIRY>
```

When you use the `--path` option the block is similar to this:

```
ignore:
  '<ISSUE_ID>':
    - '<PATH_TO_RESOURCE>':
        reason: <REASON>
        expires: <EXPIRY>
```

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--id=<ISSUE_ID>`

Snyk ID for the issue to ignore. Required.

### `--expiry=<EXPIRY>`

Expiry date in `YYYY-MM-DD` format ([ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) and [RFC 2822](https://tools.ietf.org/html/rfc2822) are supported).

Default: 30 days

### `--reason=<REASON>`

Human-readable `<REASON>` to ignore this issue.

Default: none

### `--policy-path=<PATH_TO_POLICY_FILE>`

Path to a `.snyk` policy file to pass manually.

Default: none

### `--path=<PATH_TO_RESOURCE>`

Path to resource for which to ignore the issue.

Use to narrow the scope of the ignore rule. When no resource path is specified, all resources are ignored.

Default: all

## Examples

Ignore a specific vulnerability:

```
$ snyk ignore --id='npm:qs:20170213' --expiry='2021-01-10' --reason='Module not affected by this vulnerability'
```

Ignore a specific vulnerability with a resource path specified:

```
$ snyk ignore --id='SNYK-JS-PATHPARSE-1077067' --expiry='2021-01-10' --path='nyc@11.9.0 > istanbul-lib-report@1.1.3 > path-parse@1.0.5' --reason='Module not affected by this vulnerability'
```

Ignore a specific vulnerability for 30 days:

```
$ snyk ignore --id=npm:tough-cookie:20160722
```
