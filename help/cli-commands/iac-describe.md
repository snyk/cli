# IAC describe

## Usage

**Note:** This feature is available in Snyk CLI version v1.876.0 or greater.

`snyk iac describe [<OPTIONS>]`

## Description

The `snyk iac describe` command detects, tracks, and alerts on infrastructure drift and unmanaged resources.

For a list of related commands see the [snyk iac](iac.md) help; `iac --help`

## Exit codes

Possible exit codes and their meaning:

**0**: success, no drift found\
**1**: drifts or unmanaged resources found\
**2**: failure

## Configure the Snyk CLI

You can use environment variables and set variables for connecting with the Snyk API; see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Configure the terraform provider

You also set variables to configure the terraform provider used by the `describe` command.

For more information see [Configure cloud providers](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/configure-cloud-providers)

## Debug

Use the `-d` option to output the debug logs.

## Options

**Note:** To use the `describe` command, you **must use at least one of these options**:

- `--only-managed` or `--drift`\
  ``Scan only managed resources from the Terraform states.
- `--only-unmanaged`\
  ``Scan only unmanaged resources.
- `--all`\
  ``Scan both managed and unmanaged resources.

See the list of options that follows for details.

### `--from=<STATE>[,<STATE>...]`

Specify multiple states to be read.

At this time, the `snyk iac describe` command supports reading Terraform states.

To read multiple states, pass `--from=` followed by a comma-separated list. You can also use glob patterns to match multiple state files at once.

For more information including **a list of supported IaC sources** and how to use them, see [IAC Sources usage](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/iac-sources-usage)

Examples:

Scan for AWS drift and aggregate both a local Terraform state and one stored in an S3 bucket:

```
$ snyk iac describe --all --from="tfstate+s3://statebucket/terraform.tfstate,tfstate://other_terraform.tfstate"
```

Scan for AWS drift and aggregate all Terraform states under a given prefix for S3:

`$ snyk iac describe --all --from="tfstate+s3://statebucket/states"`

Read and aggregate all Terraform states in a given directory:

`$ snyk iac describe --all --from="tfstate://directory/*.tfstate"`

Use any unsupported backend by using `terraform` to pipe your state in a file and then use this file:

`$ terraform state pull > state.tfstate`&#x20;

`$ snyk iac describe --all --from="tfstate://state.tfstate"`

### `--to=<PROVIDER+TYPE>`

Specify the cloud provider to scan.

The `iac describe` command supports multiple cloud providers. By default the `describe` command scans AWS, but you can change this using the `--to` option.

Usage:

`$ snyk iac describe --to="PROVIDER+TYPE"`

Example to explicitly scan AWS in a Terraform context:

`$ snyk iac describe --to="aws+tf"`

Supported providers:

- `github+tf` (GitHub with Terraform)
- `aws+tf` (Amazon Web Services with Terraform)
- `gcp+tf` (Google Cloud Platform with Terraform)
- `azure+tf` (Azure with Terraform)

### `--service=<SERVICE>[,<SERVICE]...>`

Specify the services that control which resources are included, ignored, or both in drift detection.

Specify multiple services as a comma-separated list, for example:

`$ snyk iac describe --all --service="aws_s3,aws_ec2"`

This option cannot be used with a `.snyk` drift ignore rule; the content in `.snyk` will be ignored.

The supported services are: `aws_s3`, `aws_ec2`, `aws_lambda`, `aws_rds`, `aws_route53`, `aws_iam` , `aws_vpc`, `aws_api_gateway`, `aws_apigatewayv2`, `aws_sqs`, `aws_sns`, `aws_ecr`, `aws_cloudfront`, `aws_kms`, `aws_dynamodb`, `azure_base`, `azure_compute`, `azure_storage`, `azure_network`, `azure_container`, `azure_database`, `azure_loadbalancer`, `azure_private_dns`, `google_cloud_platform`, `google_cloud_storage`, `google_compute_engine`, `google_cloud_dns`, `google_cloud_bigtable`, `google_cloud_bigquery`, `google_cloud_functions`, `google_cloud_sql`, `google_cloud_run`

### `--all`

Display a report that shows changes for both managed and unmanaged resources.

### `--only-managed`

Display a report that shows changes only for resources found in aggregated Terraform states; filter out drift for resources that are not managed by Terraform.&#x20;

Alternative: `--drift`

### `--only-unmanaged`

Display a report that shows resources not found in any Terraform state; filter out drift for managed resources.

### `--quiet`

Prevent stdout from being used for anything but the scan result.

This can be useful to pipe the output into some other command.

### `--filter`

Use filter rules.

Filter rules allow you to build a complex expression to include and exclude a set of resources in your workflow.

Building a complex include and exclude expression is powered by the expression language JMESPath.

For more information see [Filter results](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/filter-results)

### `--json`

Output the report as JSON to stdout.

You can save the report to a file with a redirection:

`$ snyk iac describe --json > report.json`&#x20;

### `--html`

Output the report as html to stdout.

### `--html-file-output=<OUTPUT_FILE_PATH>`

Output the report as html into a file.

### `--fetch-tfstate-headers`

Use a specific HTTP header or headers for the HTTP backend.

Example for HTTPS authentication to use a Terraform state stored on GitLab:

```
$ GITLAB_TOKEN=<access_token> \
  snyk iac describe --all \
  --from="tfstate+https://gitlab.com/api/v4/projects/<project_id>/terraform/state/<path_to_state>" \
 --fetch-tfstate-headers='Authorization="Bearer ${GITLAB_TOKEN}"'
```

### `--tfc-token`

Specify an API token to authenticate to the Terraform Cloud or Enterprise API.

### `--tfc-endpoint`

Read the current state for a given workspace from Terraform Enterprise by passing the `tfc-endpoint` value that is specific to your org's Terraform Enterprise installation.

You can obtain your workspace id from the **General Settings** of the workspace.

Remember to provide your Terraform Enterprise API token.

Example:

```
$ snyk iac describe --all --from="tfstate+tfcloud://$WORKSPACE_ID" --tfc-token="$TFC_TOKEN" --tfc-endpoint="https://tfe.example.com/api/v2"
```

### `--tf-provider-version`

Specify a terraform provider version to use. If none is specified, default versions are used as follows:

- aws@3.19.0
- github@4.4.0

Usage:

Specify terraform provider 3.43.0 to use this provider to avoid scan errors:

`$ DCTL_TF_PROVIDER_VERSION=3.43.0 snyk iac describe --only-unmanaged`

Use the same parameter for every cloud provider:

`$ DCTL_TF_PROVIDER_VERSION=4.10.1 snyk iac describe --all --to="github+tf"`

### `--strict`

Enable strict mode.

The `iac describe` command ignores service-linked resources by default (like service-linked AWS IAM roles, their policies and policy attachments). To include those resources in the report you can enable **strict mode**.

Note: when using the strict mode with an AWS account, you may experience unnecessary noise from resources that do not belong to you.

This can happen if you have an organization account in which you, by default, have a service-linked role associated to your the account, for example, **AWSServiceRoleForOrganizations**.&#x20;

Usage:

`$ snyk iac describe --all --strict`

### `--deep`

Enable deep mode for `--all`.

Deep mode enables retrieval of details for resources, for deeper and more detailed drift detection. &#x20;

**Note:** this option is experimental. Enabling deep mode can lead to unexpected behavior: false positive drifts or undetected drifts.

Usage:

`$ snyk iac describe --all --deep`

### `--tf-lockfile`

By default, `snyk iac describe` reads the Terraform lock file (`.terraform.lock.hcl`) from the current directory, so it can automatically detect which provider to use, according to the `--to` flag. You can specify a custom path for that file using the `--tf-lockfile` option.

If parsing the lockfile fails for some reason, errors are logged and scan continues.

**Note**: When using both the `--tf-lockfile` and `--tf-provider-version` options together, `--tf-provider-version` takes precedence overall.

Example:

`$ snyk iac describe --all --to="aws+tf" --tf-lockfile="/path/to/.terraform.lock.hcl"`

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences some features availability and private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI)

### `--config-dir`

You can change the directory path used for configuration. By default, it is the `$HOME` directory.

This can be useful, for example, if you want to invoke this command in an AWS Lambda function where you can only use the `/tmp` folder.

Usage:

```
$ snyk iac describe --only-unmanaged --config-dir="/path/to/config_dir"
```

### `--ignore-policy`

Ignore all set policies, the current policy in the `.snyk` file, org level ignores, and the project policy on snyk.io.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

## Examples for snyk iac describe command

### Detect drift on AWS with a single local Terraform state

```
$ snyk iac describe --all
$ snyk iac describe --all --from="tfstate://terraform.tfstate"
```

### Specify AWS credentials

```
$ AWS_ACCESS_KEY_ID=XXX AWS_SECRET_ACCESS_KEY=XXX snyk iac describe --all
```

### Use an AWS named profile

```
$ AWS_PROFILE=profile_name snyk iac describe --all
```

### Use a single Terraform state stored on an S3 backend

```
$ snyk iac describe --from="tfstate+s3://my-bucket/path/to/state.tfstate"
```

### Aggregate multiple Terraform states

```
$ snyk iac describe --all --from="tfstate://terraform_S3.tfstate,tfstate://terraform_VPC.tfstate"
```

### Aggregate many Terraform states, using glob pattern

```
$ snyk iac describe --all --from="tfstate://path/to/**/*.tfstate"
```
