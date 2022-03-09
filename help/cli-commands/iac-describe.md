# snyk iac describe -- find differences between Cloud and Infrastructure as Code

The `snyk iac describe` command detect, track and alert on infrastructure drift. It runs driftctl in the background.

For more information see the [driftctl documentation](https://docs.driftctl.com/).

## Exit codes

Possible exit codes and their meaning:

**0**: success, no drift found<br />
**1**: drifts or unmanaged resources found<br />
**2**: failure<br />

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect
with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

NOTE: Although driftctl is used in the background, the Snyk CLI brings its own options to run drift detection.

### `--quiet`

This flag prevents stdout to be use for anything but the scan result.

### `--filter`

Filter rules allow you to build complex expression to include and exclude a set of resources in your workflow. Powered
by expression language JMESPath you could build a complex include and exclude expression.

See [documentation for more details](https://docs.driftctl.com/0.19.0/usage/filtering/rules).

### `--json` `--json-output-file=`

Output report as json to stdout or into a file.

### `--html` `--html-output-file=`

Output report as html to stdout or into a file.

### `--to`

driftctl supports multiple providers. By default it will scan against AWS, but you can change this using `--to`.

#### Usage

Environment: `DCTL_TO`

`$ snyk iac describe --to PROVIDER+TYPE`

Examples:

`$ snyk iac describe --to aws+tf`
`$ DCTL_TO=github+tf snyk iac describe`

#### Supported Providers

driftctl supports these providers:

- `github+tf`
- `aws+tf`
- `gcp+tf`
- `azure+tf`

### `--headers`

Use a specific HTTP header(s) for the HTTP backend.

Example:

`$ GITLAB_TOKEN=<access_token> \ snyk iac describe \ --from tfstate+https://gitlab.com/api/v4/projects/<project_id>/terraform/state/<path_to_state> \ --headers "Authorization=Bearer ${GITLAB_TOKEN}"`

### `--tfc-token`

Specify an API token to authenticate to the Terraform Cloud or Enterprise API.

### `--tfc-endpoint`

You can also read the current state for a given workspace from Terraform Enterprise by passing the tfc-endpoint value
that's specific to your Org's Terraform Enterprise installation.

You can obtain your workspace id from the General Settings of the workspace.

Don't forget to provide your Terraform Enterprise API token.

Example:

`$ snyk iac describe --from tfstate+tfcloud://$WORKSPACE_ID --tfc-token $TFC_TOKEN --tfc-endpoint 'https://tfe.example.com/api/v2'`

### `--tf-provider-version`

You can specify a terraform provider version to use. If none, driftctl uses defaults like below:

- aws@3.19.0
- github@4.4.0

#### Usage

I use terraform provider 3.43.0 so I can use this provider with driftctl to avoid scan errors. driftctl will scan with an AWS terraform provider v3.43.0
`$ DCTL_TF_PROVIDER_VERSION=3.43.0 snyk iac describe`

Same parameter is used for every cloud provider.
driftctl will scan with a GitHub terraform provider v4.10.1.
`$ DCTL_TF_PROVIDER_VERSION=4.10.1 snyk iac describe --to github+tf`

### `--strict`

When running driftctl against an AWS account, you may experience unnecessary noises with resources that don't belong to
you. It can be the case if you have an organization account in which you will by default have a service-linked role
associated to your account (e.g. AWSServiceRoleForOrganizations). For now, driftctl ignores those service-linked
resources by default.

If you still want to include those resources in the report anyway, you can enable the strict mode.

For now, resources include:

- Service-linked AWS IAM roles, including their policies and policy attachments

#### Usage

`$ snyk iac describe --strict`

### `--deep`

#### Warning

This flag is **EXPERIMENTAL**. Enabling deep mode while using a Terraform state as IaC source can lead to unexpected
behaviors: false positive drifts, undetected drifts.

Deep mode enables resources details retrieval. It was the original driftctl behavior.

- In **deep** mode we compare resources details to expected ones (like a terraform plan).
- In **non-deep** mode (the default one) we only enumerate resources and display which ones are out of IaC scope.

Since it overlaps the new `terraform plan` behavior (as of Terraform 0.15 it shows diffs between your state and the
remote) we moved the original behavior under the `--deep` **experimental** flag.

#### Info

If you use a version of driftctl prior to 0.13, the deep mode was the default behavior. If you want to keep the old
behavior in a newer version you have to enable the deep mode flag.

#### Usage

`$ snyk iac describe --deep`

### `--driftignore`

The default name for a driftignore file is `.driftignore`. If for some reason you want to use a custom filename, you can
do so using the `--driftignore` flag. This is especially useful when you have multiple driftignore files, where each of
them represents a particular use case.

NOTE: You can use only one driftignore file at once.

#### Usage

Apply ignore directives from the /path/to/driftignore file

`$ snyk iac describe --driftignore /path/to/driftignore`

### `--tf-lockfile`

By default, driftctl tries to read a Terraform lock file (.terraform.lock.hcl) in the current directory, so driftctl can
automatically detect which provider to use, according to the --to flag. You can specify a custom path for that file
using the --tf-lockfile flag. If parsing the lockfile fails for some reason, errors will be logged and scan will
continue.

#### Note

When using both --tf-lockfile and --tf-provider-version flags together, --tf-provider-version will simply take
precedence overall.

#### Example

`$ snyk iac describe --to aws+tf --tf-lockfile path/to/.terraform.lock.hcl`

### `--config-dir`

You can change the directory path that driftctl uses for configuration. By default, it is the `$HOME` directory.

This can be useful, for example, if you want to invoke driftctl in an AWS Lambda function where you can only use
the `/tmp` folder.

#### Usage

`$ snyk iac describe --config-dir path_to_driftctl_config_dir`
`$ DCTL_CONFIG_DIR=path_to_driftctl_config_dir snyk iac describe`

### `--from`

Currently, driftctl only supports reading IaC from a Terraform state. We are investigating to support the Terraform code
as well, as a state does not represent an intention.

Multiple states can be read by passing `--from` a comma separated list. You can also use glob patterns to match multiple
state files at once.

Examples:

I want to read a local state and a state stored in an S3 bucket:
`$ snyk iac describe --from="tfstate+s3://statebucketdriftctl/terraform.tfstate,tfstate://terraform_toto.tfstate"`

You can also read all files under a given prefix for S3
`$ snyk iac describe --from=tfstate+s3://statebucketdriftctl/states`

#### Supported IaC sources

- Terraform state
- Local: `--from=tfstate://terraform.tfstate`
- S3: `--from=tfstate+s3://my-bucket/path/to/state.tfstate`
- GCS: `--from=tfstate+gs://my-bucket/path/to/state.tfstate`
- HTTPS: `--from=tfstate+https://my-url/state.tfstate`
- Terraform Cloud / Terraform Enterprise: `--from=tfstate+tfcloud://WORKSPACE_ID`
- Azure blob storage: `--from=tfstate+azurerm://container-name/path/to/state.tfstate`

You can use any unsupported backend by using `terraform` to pipe your state in a file and then use this file with
driftctl:

`$ terraform state pull > state.tfstate`
`$ snyk iac describe --from=tfstate://state.tfstate`

### `--service`

The services(s) specified with this argument controls which resources are going to be included/ignored in drift
detection.

When specifying multiple services, use a comma to separate them e.g. `snyk iac describe --service=aws_s3,aws_ec2`

This argument can't be used at the same time with a driftignore file, driftignore will be ignored.

Here are the available services: aws_s3, aws_ec2, aws_lambda, aws_rds, aws_route53, aws_iam, aws_vpc, aws_api_gateway, aws_apigatewayv2, aws_sqs, aws_sns, aws_ecr, aws_cloudfront, aws_kms, aws_dynamodb, azure_base, azure_compute, azure_storage, azure_network, azure_container, azure_database, azure_loadbalancer, azure_private_dns, google_cloud_platform, google_cloud_storage, google_compute_engine, google_cloud_dns, google_cloud_bigtable, google_cloud_bigquery, google_cloud_functions, google_cloud_sql, google_cloud_run

## Examples for the iac describe command

[For more information
see [Synk CLI for Infrastructure as Code](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code)
.
