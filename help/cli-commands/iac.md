# IAC

## Usage

`snyk iac <COMMAND> [<OPTIONS>] [<PATH>]`

## Description

The `snyk iac` command finds security issues in Infrastructure as Code files.

For more information see [Synk CLI for Infrastructure as Code](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code).

## Command: `test`

Test for any known issue.

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulnerabilities found\
**1**: action_needed, vulnerabilities found\
**2**: failure, try to re-run command\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--detection-depth=<DEPTH>`

Use to indicate how many sub-directories to search. `DEPTH` must be a number.

Default: no limit.

Example: `--detection-depth=3` limits search to the specified directory (or the current directory if no `<PATH>` is specified) plus three levels of subdirectories.

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account).

Example: `$ snyk iac test --org=my-team`

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI).

### `--ignore-policy`

Ignore all set policies, the current policy in the `.snyk` file, Org level ignores, and the project policy on snyk.io.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results in JSON format.

Example: `$ snyk iac test --json-file-output=vuln.json`

### `--json-file-output=<OUTPUT_FILE_PATH>`

Save test output in JSON format directly to the specified file, regardless of whether or not you use the `--json` option.

This is especially useful if you want to display the human-readable test output using stdout and at the same time save the JSON format output to a file.

### `--sarif`

Return results in SARIF format.

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

Save test output in SARIF format directly to the \<OUTPUT_FILE_PATH> file, regardless of whether or not you use the `--sarif` option.

This is especially useful if you want to display the human-readable test output using stdout and at the same time save the SARIF format output to a file.

### `--severity-threshold=<low|medium|high|critical>`

Report only vulnerabilities at the specified level or higher.

### `--scan=<TERRAFORM_PLAN_SCAN_MODE>`

Use this dedicated option for Terraform plan scanning modes to control whether the scan analyzes the full final state (for example, `planned-values`), or the proposed changes only (for example, `resource-changes`).

Default: If the `--scan` option is not specified, scan the proposed changes only by default. Example 1: `--scan=planned-values` (full state scan) Example 2: `--scan=resource-changes` (proposed changes scan)

### `--rules=<PATH_TO_CUSTOM_RULES_BUNDLE>`

Use this dedicated option for Custom Rules scanning to enable the IaC scans to use a custom rules bundle generated with the `snyk-iac-rules` SDK. See [Download learn how to use the SDK](https://github.com/snyk/snyk-iac-rules).

This option cannot be used if the custom rules settings were configured with the Snyk UI. Default: If the `--rules` flag is not specified, scan the configuration files using the internal Snyk rules only.

Example: `--rules=bundle.tar.gz` (Scan the configuration files using custom rules and internal Snyk rules.)

## Examples for the iac test command

\[For more information see [Synk CLI for Infrastructure as Code](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code).

### Test a CloudFormation file

```
$ snyk iac test /path/to/cloudformation_file.yaml
```

### Test a Kubernetes file

```
$ snyk iac test /path/to/kubernetes_file.yaml
```

### Test a Terraform file

```
$ snyk iac test /path/to/terraform_file.tf
```

### Test a Terraform plan file

```
$ terraform plan -out=tfplan.binary
$ terraform show -json tfplan.binary > tf-plan.json
$ snyk iac test tf-plan.json
```

### Test an ARM file

```
$ snyk iac test /path/to/arm_file.json
```

### Test matching files in a directory

```
$ snyk iac test /path/to/directory
```

### Test matching files in a directory using a local custom rules bundle

```
$ snyk iac test /path/to/directory --rules=bundle.tar.gz
```
