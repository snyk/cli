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

Here are the available services and the matching resources:

- **aws_s3**: aws_s3_bucket, aws_s3_bucket_analytics_configuration, aws_s3_bucket_inventory, aws_s3_bucket_metric, aws_s3_bucket_notification, aws_s3_bucket_policy
- **aws_ec2**: aws_instance, aws_key_pair, aws_ami, aws_ebs_snapshot, aws_ebs_volume, aws_eip, aws_eip_association, aws_volume_attachment, aws_launch_configuration, aws_launch_template
- **aws_lambda**: aws_lambda_function, aws_lambda_event_source_mapping
- **aws_rds**: aws_db_instance, aws_db_subnet_group, aws_rds_cluster, aws_rds_cluster_endpoint, aws_rds_cluster_instance
- **aws_route53**: aws_route53_record, aws_route53_zone
- **aws_iam**: aws_iam_access_key, aws_iam_policy, aws_iam_policy_attachment, aws_iam_role, aws_iam_role_policy, aws_iam_role_policy_attachment, aws_iam_user, aws_iam_user_policy, aws_iam_user_policy_attachment
- **aws_vpc**: aws_security_group, aws_security_group_rule, aws_subnet, aws_default_vpc, aws_vpc, aws_default_security_group, aws_route_table, aws_default_route_table, aws_route, aws_route_table_association, aws_nat_gateway, aws_internet_gateway
- **aws_api_gateway**: aws_api_gateway_resource, aws_api_gateway_rest_api, aws_api_gateway_account, aws_api_gateway_api_key, aws_api_gateway_authorizer, aws_api_gateway_base_path_mapping, aws_api_gateway_domain_name, aws_api_gateway_gateway_response, aws_api_gateway_integration, aws_api_gateway_integration_response, aws_api_gateway_method, aws_api_gateway_method_response, aws_api_gateway_method_settings, aws_api_gateway_model, aws_api_gateway_request_validator, aws_api_gateway_rest_api_policy, aws_api_gateway_stage, aws_api_gateway_vpc_link
- **aws_apigatewayv2**: aws_apigatewayv2_api, aws_apigatewayv2_api_mapping, aws_apigatewayv2_authorizer, aws_apigatewayv2_deployment, aws_apigatewayv2_domain_name, aws_apigatewayv2_integration, aws_apigatewayv2_integration_response, aws_apigatewayv2_model, aws_apigatewayv2_route, aws_apigatewayv2_route_response, aws_apigatewayv2_stage, aws_apigatewayv2_vpc_link
- **aws_sqs**: aws_sqs_queue, aws_sqs_queue_policy
- **aws_sns**: aws_sns_topic, aws_sns_topic_policy, aws_sns_topic_subscription
- **aws_ecr**: aws_ecr_repository
- **aws_cloudfront**: aws_cloudfront_distribution
- **aws_kms**: aws_kms_key, aws_kms_alias
- **aws_dynamodb**: aws_dynamodb_table
- **azure_base**: azurerm_resource_group
- **azure_compute**: azurerm_image, azurerm_ssh_public_key
- **azure_storage**: azurerm_storage_account, azurerm_storage_container
- **azure_network**: azurerm_resource_group, azurerm_subnet, azurerm_public_ip, azurerm_firewall, azurerm_route, azurerm_route_table, azurerm_network_security_group
- **azure_container**: azurerm_container_registry
- **azure_database**: azurerm_postgresql_server, azurerm_postgresql_database
- **azure_loadbalancer**: azurerm_lb, azurerm_lb_rule
- **azure_private_dns**: azurerm_private_dns_a_record, azurerm_private_dns_aaaa_record, azurerm_private_dns_cname_record, azurerm_private_dns_mx_record, azurerm_private_dns_ptr_record, azurerm_private_dns_srv_record, azurerm_private_dns_txt_record, azurerm_private_dns_zone
- **google_cloud_platform**: google_project_iam_binding, google_project_iam_member, google_project_iam_policy
- **google_cloud_storage**: google_storage_bucket, google_storage_bucket_iam_binding, google_storage_bucket_iam_member, google_storage_bucket_iam_policy
- **google_compute_engine**: google_compute_address, google_compute_disk, google_compute_global_address, google_compute_firewall, google_compute_health_check, google_compute_image, google_compute_instance, google_compute_instance_group, google_compute_network, google_compute_node_group, google_compute_router, google_compute_subnetwork
- **google_cloud_dns**: google_dns_managed_zone
- **google_cloud_bigtable**: google_bigtable_instance, google_bigtable_table
- **google_cloud_bigquery**: google_bigquery_table, google_bigquery_dataset
- **google_cloud_functions**: google_cloudfunctions_function
- **google_cloud_sql**: google_sql_database_instance
- **google_cloud_run**: google_cloud_run_service - **aws_s3**: aws_s3_bucket, aws_s3_bucket_analytics_configuration, aws_s3_bucket_inventory, aws_s3_bucket_metric, aws_s3_bucket_notification, aws_s3_bucket_policy
- **aws_ec2**: aws_instance, aws_key_pair, aws_ami, aws_ebs_snapshot, aws_ebs_volume, aws_eip, aws_eip_association, aws_volume_attachment, aws_launch_configuration, aws_launch_template
- **aws_lambda**: aws_lambda_function, aws_lambda_event_source_mapping
- **aws_rds**: aws_db_instance, aws_db_subnet_group, aws_rds_cluster, aws_rds_cluster_endpoint, aws_rds_cluster_instance
- **aws_route53**: aws_route53_record, aws_route53_zone
- **aws_iam**: aws_iam_access_key, aws_iam_policy, aws_iam_policy_attachment, aws_iam_role, aws_iam_role_policy, aws_iam_role_policy_attachment, aws_iam_user, aws_iam_user_policy, aws_iam_user_policy_attachment
- **aws_vpc**: aws_security_group, aws_security_group_rule, aws_subnet, aws_default_vpc, aws_vpc, aws_default_security_group, aws_route_table, aws_default_route_table, aws_route, aws_route_table_association, aws_nat_gateway, aws_internet_gateway
- **aws_api_gateway**: aws_api_gateway_resource, aws_api_gateway_rest_api, aws_api_gateway_account, aws_api_gateway_api_key, aws_api_gateway_authorizer, aws_api_gateway_base_path_mapping, aws_api_gateway_domain_name, aws_api_gateway_gateway_response, aws_api_gateway_integration, aws_api_gateway_integration_response, aws_api_gateway_method, aws_api_gateway_method_response, aws_api_gateway_method_settings, aws_api_gateway_model, aws_api_gateway_request_validator, aws_api_gateway_rest_api_policy, aws_api_gateway_stage, aws_api_gateway_vpc_link
- **aws_apigatewayv2**: aws_apigatewayv2_api, aws_apigatewayv2_api_mapping, aws_apigatewayv2_authorizer, aws_apigatewayv2_deployment, aws_apigatewayv2_domain_name, aws_apigatewayv2_integration, aws_apigatewayv2_integration_response, aws_apigatewayv2_model, aws_apigatewayv2_route, aws_apigatewayv2_route_response, aws_apigatewayv2_stage, aws_apigatewayv2_vpc_link
- **aws_sqs**: aws_sqs_queue, aws_sqs_queue_policy
- **aws_sns**: aws_sns_topic, aws_sns_topic_policy, aws_sns_topic_subscription
- **aws_ecr**: aws_ecr_repository
- **aws_cloudfront**: aws_cloudfront_distribution
- **aws_kms**: aws_kms_key, aws_kms_alias
- **aws_dynamodb**: aws_dynamodb_table
- **azure_base**: azurerm_resource_group
- **azure_compute**: azurerm_image, azurerm_ssh_public_key
- **azure_storage**: azurerm_storage_account, azurerm_storage_container
- **azure_network**: azurerm_resource_group, azurerm_subnet, azurerm_public_ip, azurerm_firewall, azurerm_route, azurerm_route_table, azurerm_network_security_group
- **azure_container**: azurerm_container_registry
- **azure_database**: azurerm_postgresql_server, azurerm_postgresql_database
- **azure_loadbalancer**: azurerm_lb, azurerm_lb_rule
- **azure_private_dns**: azurerm_private_dns_a_record, azurerm_private_dns_aaaa_record, azurerm_private_dns_cname_record, azurerm_private_dns_mx_record, azurerm_private_dns_ptr_record, azurerm_private_dns_srv_record, azurerm_private_dns_txt_record, azurerm_private_dns_zone
- **google_cloud_platform**: google_project_iam_binding, google_project_iam_member, google_project_iam_policy
- **google_cloud_storage**: google_storage_bucket, google_storage_bucket_iam_binding, google_storage_bucket_iam_member, google_storage_bucket_iam_policy
- **google_compute_engine**: google_compute_address, google_compute_disk, google_compute_global_address, google_compute_firewall, google_compute_health_check, google_compute_image, google_compute_instance, google_compute_instance_group, google_compute_network, google_compute_node_group, google_compute_router, google_compute_subnetwork
- **google_cloud_dns**: google_dns_managed_zone
- **google_cloud_bigtable**: google_bigtable_instance, google_bigtable_table
- **google_cloud_bigquery**: google_bigquery_table, google_bigquery_dataset
- **google_cloud_functions**: google_cloudfunctions_function
- **google_cloud_sql**: google_sql_database_instance
- **google_cloud_run**: google_cloud_run_service

## Examples for the iac describe command

[For more information
see [Synk CLI for Infrastructure as Code](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code)
.
