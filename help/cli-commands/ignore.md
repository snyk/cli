# Ignore

## Usage

`snyk ignore --id=<ISSUE_ID> [--expiry=] [--reason=] [--policy-path=<PATH_TO_POLICY_FILE>] [--path=<PATH_TO_RESOURCE>] [OPTIONS]`

OR

`snyk ignore [--expiry=] [--reason=] [--policy-path=<PATH_TO_POLICY_FILE>] [--file-path=<PATH_TO_RESOURCE>] [OPTIONS]`

## Description

The `snyk ignore` command modifies the `.snyk` policy file to ignore a stated issue according to its snyk ID for all occurrences, its expiry date, a reason, or according to paths in the filesystem.

This updates your local `.snyk` file to contain a block similar to the following:

```yaml
ignore:
  '<ISSUE_ID>':
    - '*':
        reason: <REASON>
        expires: <EXPIRY>
```

When you use the `--path` option the block is similar to this:

```yaml
ignore:
  '<ISSUE_ID>':
    - '<PATH_TO_RESOURCE>':
        reason: <REASON>
        expires: <EXPIRY>
```

When you use the `--file-path` option the block is similar to this:

```yaml
exclude:
  '<GROUP>':
    - <FILE MATCHING-PATTERN>
    - <FILE MATCHING-PATTERN>:
      reason: <REASON>
      expires: <EXPIRY>
      created: <CREATION TIME>
```

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--id=<ISSUE_ID>`

Snyk ID for the issue to ignore, omitted if used with `--file-path`; required by other use cases.

### `--expiry=<EXPIRY>`

Expiry date in `YYYY-MM-DD` format.

Supported formats:

[ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html)

[RFC 2822](https://tools.ietf.org/html/rfc2822)

Default: 30 days or none if used with `--file-path`

### `--reason=<REASON>`

Human-readable `<REASON>` to ignore this issue.

Default: none

### `--policy-path=<PATH_TO_POLICY_FILE>`

Path to a `.snyk` policy file to pass manually.

Default: none

### `--path=<PATH_TO_RESOURCE>`

Path to resource inside the depgraph for which to ignore the issue.

Use to narrow the scope of the ignore rule. When no resource path is specified, all resources are ignored.

You can specify component versions in the path using [https://github.com/npm/node-semver#versions](https://github.com/npm/node-semver#versions)

If used, follows the `--policy-path` option.

Default: all

### `--file-path=<PATH_TO_RESOURCE>`

Filesystem for which to ignore the issue. Used by `snyk code` and `snyk test --unmanaged`

Default: none

### `--file-path-group=[global|code|iac-drift]`

Grouping used in combination with `--file-path`, otherwise omitted.

Default: global

## Examples for snyk ignore command

### Ignore a specific vulnerability

```
$ snyk ignore --id='npm:qs:20170213' --expiry='2021-01-10' --reason='Module not affected by this vulnerability'
```

### Ignore a specific vulnerability with a resource path specified

```
$ snyk ignore --id='SNYK-JS-PATHPARSE-1077067' --expiry='2021-01-10' --path='nyc@11.9.0 > istanbul-lib-report@1.1.3 > path-parse@1.0.5' --reason='Module not affected by this vulnerability'
```

### Ignore a specific vulnerability for 30 days

```
$ snyk ignore --id=npm:tough-cookie:20160722
```

### Ignore a specific file until 2031-01-20

Ignore a specific file, used by `snyk test --unmanaged` until 2031-01-20, with a description as a reference for the future.

```
$ snyk ignore --file-path='./deps/curl-7.58.0/src/tool_msgs.c' --expiry='2031-01-20' --reason='patched file'
```

### Ignore files or folders using glob expression

Ignore files matching a glob expression by adding them to a specific group. Applies to Snyk Code; does not apply to Snyk Open Source, Container, or Infrastructure as Code.

```
$ snyk ignore --file-path='./**/vendor/**/*.cpp' --file-path-group='global'
```

## More information about snyk ignore command

For more information see:

- [Ignore vulnerabilities using Snyk CLI](https://docs.snyk.io/snyk-cli/test-for-vulnerabilities/ignore-vulnerabilities-using-snyk-cli)
- [IaC ignores using the .snyk policy file](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code/iac-ignores-using-the-.snyk-policy-file)
