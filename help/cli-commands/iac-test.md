# IaC test

## Usage

`snyk iac test [<OPTIONS>] [<PATH>]`

## Description

The `snyk iac test` command tests for any known security issue.

For a list of related commands see the [snyk iac](iac.md) help; `iac --help`

For more information see [Snyk CLI for Infrastructure as Code](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code)

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulnerabilities found\
**1**: action_needed, vulnerabilities found\
**2**: failure, try to re-run command\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--detection-depth=<DEPTH>`

Indicate how many subdirectories to search. `DEPTH` must be a number, 1 or greater; zero (0) is the current directory.

Default: no limit.

Example: `--detection-depth=3` limits search to the specified directory (or the current directory if no `<PATH>` is specified) plus three levels of subdirectories; zero (0) is the current directory.

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

Note that you can also use `--org=<orgslugname>`. The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI)

### `--ignore-policy`

Ignore all set policies, the current policy in the `.snyk` file, org level ignores, and the project policy on snyk.io.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results on the console as a JSON data structure.

Example: `$ snyk iac test --json`

### `--json-file-output=<OUTPUT_FILE_PATH>`

Save test output as a JSON data structure directly to the specified file, regardless of whether or not you use the `--json` option.

Use to display the human-readable test output using stdout and at the same time save the JSON data structure output to a file.

Example: `$ snyk iac test --json-file-output=vuln.json`

### `--sarif`

Return results in SARIF format.

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

Save test output in SARIF format directly to the \<OUTPUT_FILE_PATH> file, regardless of whether or not you use the `--sarif` option.

This is especially useful if you want to display the human-readable test output using stdout and at the same time save the SARIF format output to a file.

Note: If you use an option that sets project attributes and your role lacks permission to edit project attributes the `iac test` command fails. For instructions on how to proceed see [Editing project attributes from the Snyk CLI](https://docs.snyk.io/features/user-and-group-management/managing-users-and-permissions/managing-permissions#editing-project-attributes-from-the-snyk-cli)

### `--project-business-criticality=<BUSINESS_CRITICALITY>[,<BUSINESS_CRITICALITY>]...>`

This can be used in combination with the `--report` option.

Set the project business criticality project attribute to one or more values (comma-separated). To clear the project business criticality set `--project-business-criticality=`

Allowed values: `critical, high, medium, low`

For more information see [Project attributes](https://docs.snyk.io/getting-started/introduction-to-snyk-projects/view-project-information/project-attributes)

This option is not supported for Integrated IaC (Limited Availability).

### `--project-environment=<ENVIRONMENT>[,<ENVIRONMENT>]...>`

This can be used in combination with the `--report` option.

Set the project environment project attribute to one or more values (comma-separated). To clear the project environment set `--project-environment=`

Allowed values: `frontend`, `backend`, `internal`, `external`, `mobile`, `saas`, `onprem`, `hosted`, `distributed`

For more information see [Project attributes](https://docs.snyk.io/getting-started/introduction-to-snyk-projects/view-project-information/project-attributes)

This option is not supported for Integrated IaC (Limited Availability).

### `--project-lifecycle=<LIFECYCLE>[,<LIFECYCLE>]...>`

This can be used in combination with the `--report` option.

Set the project lifecycle project attribute to one or more values (comma-separated). To clear the project lifecycle set `--project-lifecycle=`

Allowed values: `production`, `development`, `sandbox`

For more information see [Project attributes](https://docs.snyk.io/getting-started/introduction-to-snyk-projects/view-project-information/project-attributes)

This option is not supported for Integrated IaC (Limited Availability).

### `--project-tags=<TAG>[,<TAG>]...>`

This can be used in combination with the `--report` option.

Set the project tags to one or more values (comma-separated key value pairs with an "=" separator).

Example: `--project-tags=department=finance,team=alpha`

To clear the project tags set `--project-tags=`

This option is not supported for Integrated IaC (Limited Availability).

### `--remote-repo-url=<URL>`

This can be used in combination with the `--report` option.

Set or override the remote URL for the repository.&#x20;

### `--report`

**NEW** option: Share results with the Snyk Web UI.

This creates a project in your Snyk account with a snapshot of the current configuration issues. After using this option, log in to the Snyk website and view your projects to see the monitor.

Example: `$ snyk iac test --report`

Note: This option cannot be used in combination with the `--rules` option.

### `--rules=<PATH_TO_CUSTOM_RULES_BUNDLE>`

Use this dedicated option for Custom Rules scanning to enable the IaC scans to use a custom rules bundle generated with the `snyk-iac-rules` SDK. See [`snyk-iac-rules` SDK](https://github.com/snyk/snyk-iac-rules#readme)

This option cannot be used if the custom rules settings were configured with the Snyk UI. Default: If the `--rules` option is not specified, scan the configuration files using the internal Snyk rules only.

Example: Scan the configuration files using custom rules and internal Snyk rules.

`--rules=bundle.tar.gz`

Note: This option can not be used in combination with the `--report` option.

This option is not supported for Integrated IaC (Limited Availability).

### `--severity-threshold=<low|medium|high|critical>`

Report only vulnerabilities at the specified level or higher.

### `--scan=<TERRAFORM_PLAN_SCAN_MODE>`

Use this dedicated option for Terraform plan scanning modes to control whether the scan analyzes the full final state (for example, `planned-values`), or the proposed changes only (for example, `resource-changes`).

Default: If the `--scan` option is not specified, scan the proposed changes only by default. Example 1: `--scan=planned-values` (full state scan)\
Example 2: `--scan=resource-changes` (proposed changes scan)

### `--target-name=<TARGET_NAME>`

This can be used in combination with the `--report` option.

Set or override the project name for the repository.&#x20;

Note: This option supersedes`--remote-repo-url`, if both options are used together.

### `--target-reference=<TARGET_REFERENCE>`

This can be used in combination with the `--report` option.

Specify a reference which differentiates this project, for example, a branch name or version. Projects having the same reference can be grouped based on that reference.

Example, setting to the current Git branch:

`snyk iac test myproject/ --report --target-reference="$(git branch --show-current)"`

Example, setting to the latest Git tag:

`snyk iac test myproject/ --report --target-reference="$(git describe --tags --abbrev=0)"`

### `--var-file=<PATH_TO_VARIABLE_FILE>`

Load a terraform variable definitions file that is located in a different directory from the scanned one.

Example:

`$ snyk iac test myproject/staging/networking --var-file=myproject/vars.tf`

### `--snyk-cloud-environment=<ENVIRONMENT_ID>`

Use the last scan from your Snyk Cloud Environment to suppress issues. For more information, see [Adding cloud context to your IaC test](https://docs.snyk.io/products/snyk-infrastructure-as-code/integrated-infrastructure-as-code/adding-cloud-context-to-your-iac-test)

This option is only supported for Integrated IaC (Limited Availability).

Example:

`$ snyk iac test --snyk-cloud-environment=0d19dc1a-c2aa-4719-89ee-5f281dd92a20`

### `--cloud-context=<ENVIRONMENT>`

Scan your cloud environment and use the result to suppress issues. For information on how to authenticate with your cloud provider, see [Adding cloud context to your IaC test](https://docs.snyk.io/products/snyk-infrastructure-as-code/integrated-infrastructure-as-code/adding-cloud-context-to-your-iac-test)

This option is only supported for Integrated IaC (Limited Availability).

Example:

`$ snyk iac test --cloud-context=aws`

## Examples for snyk iac test command

For more information see [Snyk CLI for Infrastructure as Code](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code)

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
