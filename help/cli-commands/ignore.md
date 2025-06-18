# Ignore

## Usage and description

### Ignore

`snyk ignore --id=<ISSUE_ID> [--expiry=] [--reason=] [--policy-path=<PATH_TO_POLICY_FILE>] [--path=<PATH_TO_RESOURCE>] [OPTIONS]`

The `snyk ignore` command modifies the `.snyk` policy file to ignore a specified issue according to its Snyk ID for all occurrences, its expiry date, a reason, or according to paths in the filesystem for the policy, the issue, or both.

**Note:** Ignoring issues or vulnerabilities using the `.snyk` file is not supported for Snyk Code.

### Exclude

`snyk ignore [--expiry=] [--reason=] [--policy-path=<PATH_TO_POLICY_FILE>] [--file-path=<PATH_TO_RESOURCE>] [OPTIONS]`

You can exclude directories or files from scanning using the `--file-path` option. This option is available only for Snyk Code (SAST) tests or Open Source `--unmanaged` tests; it will not work for other test types.

## Examples of updates to the `.snyk` file

### Updates for ignores

The `snyk ignore` command for an `ISSUE_ID` updates your local `.snyk` file to contain a block similar to the following:

```yaml
ignore:
  '<ISSUE_ID>':
    - '*':
        reason: <REASON>
        expires: <EXPIRY>
```

When you use the `--path` option for an ignore, the block is similar to this:

```yaml
ignore:
  '<ISSUE_ID>':
    - '<PATH_TO_RESOURCE>':
        reason: <REASON>
        expires: <EXPIRY>
```

### Update for an exclude

When you use the `--file-path` option the block is similar to this:

```yaml
exclude:
  '<GROUP>':
    - <FILE MATCHING-PATTERN>
    - <FILE MATCHING-PATTERN>:
      expires: <EXPIRY>
      created: <CREATION TIME>
```

**Note**: Ignoring issues or vulnerabilities using the `.snyk` file is not supported for Snyk Code.

The `--file-path` option excludes directories or files from scanning and is available only for Snyk Code (SAST) tests or Open Source `--unmanaged` tests; it will not work for other test types.

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--id=<ISSUE_ID>`

Snyk ID for the issue to ignore, omitted if the `ignore` command used with `--file-path`, otherwise required.

### `--expiry=<EXPIRY>`

Expiry date in `YYYY-MM-DD` format.

Supported formats:

[ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html)

[RFC 2822](https://tools.ietf.org/html/rfc2822)

Default: 30 days or none if used with `--file-path`

Note: The `expiry` field is not required. If you need a permanent ignore, omit the option.

To ensure that expiration dates are enforced for ignores, you must specify a valid expiration date. The date must be in the Date Time String Javascript format like YYYY-MM-DDThh:mm:ss.fffZ. If the specified expiration date does not adhere to this format, the ignore will be respected and persist indefinitely.

### `--reason=<REASON>`

Human-readable `<REASON>` to ignore this issue.

Default: none

**Note**: Not supported for Snyk Code.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Path to a `.snyk` policy file to pass manually.

Default: none

### `--path=<PATH_TO_RESOURCE>`

Path to resource inside the depgraph for which to ignore the issue.

Use to narrow the scope of the ignore rule. When no resource path is specified, all resources are ignored.

For ecosystems which use the semver convention for versioning, you can specify component versions in the path using [https://github.com/npm/node-semver#versions](https://github.com/npm/node-semver#versions)

If used, follows the `--policy-path` option.

Default: all

### `--file-path=<PATH_TO_RESOURCE>`

Filesystem for which to exclude directories or files from scanning. Used only by `snyk code` and `snyk test --unmanaged`

Default: none

### `--file-path-group=[global|code|iac-drift]`

Grouping used in combination with `--file-path`, otherwise omitted.

Default: global

## Examples for `snyk ignore` command

### Ignore a specific vulnerability with the expiry and reason specified

```
$ snyk ignore --id='npm:qs:20170213' --expiry='2021-01-10' --reason='Module not affected by this vulnerability'
```

### Ignore a specific vulnerability with the expiry, a resource path, and reason specified

```
$ snyk ignore --id='SNYK-JS-PATHPARSE-1077067' --expiry='2021-01-10' --path='nyc@11.9.0 > istanbul-lib-report@1.1.3 > path-parse@1.0.5' --reason='Module not affected by this vulnerability
```

### Ignore a specific vulnerability with an expiry date and path specified

```
$ snyk ignore --id='SNYK-JS-PATHPARSE-1077067' --expiry='2021-01-10' --path='nyc@11.9.0
```

### Ignore a specific vulnerability with a resource path specified (Windows)&#x20;

In this example, `snyk iac test` on Windows returned a Path containing single quotes and a File specification containing back slashes:

Rule: [https://security.snyk.io/rules/cloud/SNYK-CC-TF-118](https://security.snyk.io/rules/cloud/SNYK-CC-TF-118)\
Path: resource > aws_iam_role\[OrganizationAccountAccessRole] > assume_role_policy\['Statement']\[0]\
File: terraform\environment\com\iam.tf

The corresponding `snyk ignore` command would be:

`snyk ignore --id=SNYK-CC-TF-118 --path="terraform\environment\com\iam.tf > resource > aws_iam_role[OrganizationAccountAccessRole] > assume_role_policy['Statement'][0]"`

### Ignore a specific vulnerability with a resource path specified (Linux, Mac OS)&#x20;

In this example, `snyk iac test` on Linux or Mac OS returned a Path containing single quotes and a File specification containing forward slashes:

Rule: [https://security.snyk.io/rules/cloud/SNYK-CC-TF-118](https://security.snyk.io/rules/cloud/SNYK-CC-TF-118)\
Path: resource > aws_iam_role\[OrganizationAccountAccessRole] > assume_role_policy\['Statement']\[0]\
File: terraform/environment/com/iam.tf

The corresponding `snyk ignore` command would be:

`snyk ignore --id=SNYK-CC-TF-118 --path="terraform/environment/com/iam.tf > resource > aws_iam_role[OrganizationAccountAccessRole] > assume_role_policy['Statement'][0]"`

### Ignore a specific vulnerability for 30 days

```
$ snyk ignore --id=npm:tough-cookie:20160722
```

### Ignore a specific file until 2031-01-20

Ignore a specific file.

The rule created in the `.snyk` file is used by `snyk test --unmanaged` until 2031-01-20, with a description as a reference for the future.

```
$ snyk ignore --file-path='./deps/curl-7.58.0/src/tool_msgs.c' --expiry='2031-01-20' --reason='patched file'
```

### Ignore files or folders using glob expression - Snyk Code and `unmanaged` only

To ignore files matching a glob expression, add them to a specific group.

This applies to Snyk Code; it does not apply to Snyk Open Source except `unmanaged`, to Container, or to IaC.

```
$ snyk ignore --file-path='./**/vendor/**/*.cpp' --file-path-group='global'
```

## More information about the `snyk ignore` command

For more information see:

- [Ignore vulnerabilities using Snyk CLI](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/ignore-vulnerabilities-using-the-snyk-cli)
- [IaC ignores using the .snyk policy file](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-iac/iac-ignores-using-the-.snyk-policy-file)
