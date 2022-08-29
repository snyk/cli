# IaC describe

## Usage

**Note:** This feature is available in Snyk CLI version v1.876.0 or greater.

`snyk iac describe [<OPTIONS>]`

## Description

The `snyk iac describe` command detects infrastructure drift and unmanaged resources. It compares resources in your Terraform state file against actual resources in your cloud provider and outputs a report.

- Resources in your Terraform state files are **managed resources**.
- Changes to managed resources not reflected in the Terraform state file are **drifts**.
- Resources that exist but are not in your Terraform state file are **unmanaged resources**.

For detailed information and examples, see [IaC describe command examples](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/iac-describe-command-examples)

For a list of related commands see the snyk [iac help](iac.md); `iac --help`

## Exit codes

Possible exit codes and their meaning:

**0**: success, no drift found\
**1**: drifts or unmanaged resources found\
**2**: failure

## Configure the Snyk CLI

You can use environment variables and set variables for connecting with the Snyk API; see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Configure the Terraform provider

You can set environment variables to configure the Terraform provider used by the `describe` command; see [Configure cloud providers](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/configure-cloud-providers)

## Debug

Use the `-d` option to output the debug logs.

## Required options

**Note:** To use the `describe` command, you **must use one of these options**:

### `--only-unmanaged`

Report resources not found in any Terraform states.

### `--only-managed` or `--drift`

Scan managed resources found in Terraform states for changes.

### `--all`

Scan both managed and unmanaged resources.

## Optional arguments

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific organization. Overrides the default `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

Note that you can also use `--org=<orgslugname>`. The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI)

### `--from=<STATE>[,<STATE>...]`

Specify multiple Terraform state files to be read. Glob patterns are supported.

For more information including **a list of supported IaC sources** and how to use them, see [IAC Sources usage](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/iac-sources-usage)

### `--to=<PROVIDER+TYPE>`

Specify the cloud provider to scan (default: AWS with Terraform).

Supported providers:

- `github+tf` (GitHub with Terraform)
- `aws+tf` (Amazon Web Services with Terraform)
- `gcp+tf` (Google Cloud Platform with Terraform)
- `azure+tf` (Azure with Terraform)

### `--tf-provider-version`

Specify a Terraform provider version to use. If none is specified, default versions are used as follows:

- aws@3.19.0
- github@4.4.0
- google@3.78.0
- azurerm@2.71.0

### `--tf-lockfile`

Read the Terraform lock file (`.terraform.lock.hcl`) from a custom path (default: current directory).

If parsing the lockfile fails, errors are logged and scan continues.

**Note**: When you are using both the `--tf-lockfile` and `--tf-provider-version` options together, `--tf-provider-version` takes precedence.

### `--fetch-tfstate-headers`

Use a specific HTTP header or headers for the HTTP backend when fetching Terraform state.

### `--tfc-token`

Specify an API token to authenticate to the Terraform Cloud or Enterprise API.

### `--tfc-endpoint`

Read the current state for a given workspace from Terraform Enterprise by passing the `tfc-endpoint` value that is specific to your org's Terraform Enterprise installation.

### `--config-dir`

Change the directory path used for `iac describe` configuration (default `$HOME`). This can be useful, for example, if you want to invoke this command in an AWS Lambda function where you can only use the `/tmp` folder.

## Options for including and excluding resources

### `--service=<SERVICE>[,<SERVICE>...]`

Specify the services whose resources are inspected for drift or unmanaged resources.

This option cannot be used with a `.snyk` drift ignore rule; the content in `.snyk` will be ignored.

Supported services: `aws_s3`, `aws_ec2`, `aws_lambda`, `aws_rds`, `aws_route53`, `aws_iam` , `aws_vpc`, `aws_api_gateway`, `aws_apigatewayv2`, `aws_sqs`, `aws_sns`, `aws_ecr`, `aws_cloudfront`, `aws_kms`, `aws_dynamodb`, `azure_base`, `azure_compute`, `azure_storage`, `azure_network`, `azure_container`, `azure_database`, `azure_loadbalancer`, `azure_private_dns`, `google_cloud_platform`, `google_cloud_storage`, `google_compute_engine`, `google_cloud_dns`, `google_cloud_bigtable`, `google_cloud_bigquery`, `google_cloud_functions`, `google_cloud_sql`, `google_cloud_run`

### `--filter`

Use filter rules.

Filter rules allow you to build a JMESPath expression to include or exclude a set of resources from the report.

To filter on resource attributes, deep mode must be enabled. Deep mode is enabled by default for `--all` and `--only-managed`. To enable deep mode while using `--only-unmanaged`, use the `--deep` option.

For more information see [Filter results](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/filter-results)

### `--deep`

Enable deep mode. Deep mode enables you to use the `--filter` option to include or exclude resources in the report based on their attributes.

Deep mode is enabled by default for `--all` and `--only-managed`. Use `--deep` if you want to filter on attributes while using `--only-unmanaged`.

For more information see [Filter results](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/filter-results)

### `--strict`

Enable strict mode.

The `iac describe` command ignores service-linked resources by default (like service-linked AWS IAM roles, their policies and policy attachments). To include those resources in the report you can enable **strict mode**. Note that this can create noise when used with an AWS account.

## Options for policies

### `--ignore-policy`

Ignore all set policies, the current policy in the `.snyk` file, org level ignores, and the project policy in the Snyk Web UI.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

## Options for output

### `--quiet`

Output only the scan result to stdout.

### `--json`

Output the report as JSON to stdout.

### `--html`

Output the report as html to stdout.

### `--html-file-output=<OUTPUT_FILE_PATH>`

Output the report as html into a file.

## Examples for snyk iac describe command

For more examples, see [IaC describe command examples](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/iac-describe-command-examples)

### Detect drift and unmanaged resources on AWS with a single local Terraform state

```
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
