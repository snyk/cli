import { CustomError } from '../errors';
import { IaCErrorCodes } from '../../cli/commands/test/iac-local-execution/types';
import { getErrorStringCode } from '../../cli/commands/test/iac-local-execution/error-utils';

export const services2resources = new Map<string, Array<string>>([
  // Amazon
  [
    'aws_s3',
    [
      'aws_s3_bucket',
      'aws_s3_bucket_analytics_configuration',
      'aws_s3_bucket_inventory',
      'aws_s3_bucket_metric',
      'aws_s3_bucket_notification',
      'aws_s3_bucket_policy',
    ],
  ],
  [
    'aws_ec2',
    [
      'aws_instance',
      'aws_key_pair',
      'aws_ami',
      'aws_ebs_snapshot',
      'aws_ebs_volume',
      'aws_eip',
      'aws_eip_association',
      'aws_volume_attachment',
      'aws_launch_configuration',
      'aws_launch_template',
    ],
  ],
  ['aws_lambda', ['aws_lambda_function', 'aws_lambda_event_source_mapping']],
  [
    'aws_rds',
    [
      'aws_db_instance',
      'aws_db_subnet_group',
      'aws_rds_cluster',
      'aws_rds_cluster_endpoint',
      'aws_rds_cluster_instance',
    ],
  ],
  ['aws_route53', ['aws_route53_record', 'aws_route53_zone']],
  [
    'aws_iam',
    [
      'aws_iam_access_key',
      'aws_iam_policy',
      'aws_iam_policy_attachment',
      'aws_iam_role',
      'aws_iam_role_policy',
      'aws_iam_role_policy_attachment',
      'aws_iam_user',
      'aws_iam_user_policy',
      'aws_iam_user_policy_attachment',
    ],
  ],
  [
    'aws_vpc',
    [
      'aws_security_group',
      'aws_security_group_rule',
      'aws_subnet',
      'aws_default_vpc',
      'aws_vpc',
      'aws_default_security_group',
      'aws_route_table',
      'aws_default_route_table',
      'aws_route',
      'aws_route_table_association',
      'aws_nat_gateway',
      'aws_internet_gateway',
    ],
  ],
  [
    'aws_api_gateway',
    [
      'aws_api_gateway_resource',
      'aws_api_gateway_rest_api',
      'aws_api_gateway_account',
      'aws_api_gateway_api_key',
      'aws_api_gateway_authorizer',
      'aws_api_gateway_base_path_mapping',
      'aws_api_gateway_domain_name',
      'aws_api_gateway_gateway_response',
      'aws_api_gateway_integration',
      'aws_api_gateway_integration_response',
      'aws_api_gateway_method',
      'aws_api_gateway_method_response',
      'aws_api_gateway_method_settings',
      'aws_api_gateway_model',
      'aws_api_gateway_request_validator',
      'aws_api_gateway_rest_api_policy',
      'aws_api_gateway_stage',
      'aws_api_gateway_vpc_link',
    ],
  ],
  [
    'aws_apigatewayv2',
    [
      'aws_apigatewayv2_api',
      'aws_apigatewayv2_api_mapping',
      'aws_apigatewayv2_authorizer',
      'aws_apigatewayv2_deployment',
      'aws_apigatewayv2_domain_name',
      'aws_apigatewayv2_integration',
      'aws_apigatewayv2_integration_response',
      'aws_apigatewayv2_model',
      'aws_apigatewayv2_route',
      'aws_apigatewayv2_route_response',
      'aws_apigatewayv2_stage',
      'aws_apigatewayv2_vpc_link',
    ],
  ],
  ['aws_sqs', ['aws_sqs_queue', 'aws_sqs_queue_policy']],
  [
    'aws_sns',
    ['aws_sns_topic', 'aws_sns_topic_policy', 'aws_sns_topic_subscription'],
  ],
  ['aws_ecr', ['aws_ecr_repository']],
  ['aws_cloudfront', ['aws_cloudfront_distribution']],
  ['aws_kms', ['aws_kms_key', 'aws_kms_alias']],
  ['aws_dynamodb', ['aws_dynamodb_table']],
  // Azure
  ['azure_base', ['azurerm_resource_group']],
  ['azure_compute', ['azurerm_image', 'azurerm_ssh_public_key']],
  ['azure_storage', ['azurerm_storage_account', 'azurerm_storage_container']],
  [
    'azure_network',
    [
      'azurerm_resource_group',
      'azurerm_subnet',
      'azurerm_public_ip',
      'azurerm_firewall',
      'azurerm_route',
      'azurerm_route_table',
      'azurerm_network_security_group',
    ],
  ],
  ['azure_container', ['azurerm_container_registry']],
  [
    'azure_database',
    ['azurerm_postgresql_server', 'azurerm_postgresql_database'],
  ],
  ['azure_loadbalancer', ['azurerm_lb', 'azurerm_lb_rule']],
  [
    'azure_private_dns',
    [
      'azurerm_private_dns_a_record',
      'azurerm_private_dns_aaaa_record',
      'azurerm_private_dns_cname_record',
      'azurerm_private_dns_mx_record',
      'azurerm_private_dns_ptr_record',
      'azurerm_private_dns_srv_record',
      'azurerm_private_dns_txt_record',
      'azurerm_private_dns_zone',
    ],
  ],

  // Google
  [
    'google_cloud_platform',
    [
      'google_project_iam_binding',
      'google_project_iam_member',
      'google_project_iam_policy',
    ],
  ],
  [
    'google_cloud_storage',
    [
      'google_storage_bucket',
      'google_storage_bucket_iam_binding',
      'google_storage_bucket_iam_member',
      'google_storage_bucket_iam_policy',
    ],
  ],
  [
    'google_compute_engine',
    [
      'google_compute_address',
      'google_compute_disk',
      'google_compute_global_address',
      'google_compute_firewall',
      'google_compute_health_check',
      'google_compute_image',
      'google_compute_instance',
      'google_compute_instance_group',
      'google_compute_instance_group_manager',
      'google_compute_network',
      'google_compute_node_group',
      'google_compute_router',
      'google_compute_subnetwork',
    ],
  ],
  ['google_cloud_dns', ['google_dns_managed_zone']],
  [
    'google_cloud_bigtable',
    ['google_bigtable_instance', 'google_bigtable_table'],
  ],
  [
    'google_cloud_bigquery',
    ['google_bigquery_table', 'google_bigquery_dataset'],
  ],
  ['google_cloud_functions', ['google_cloudfunctions_function']],
  ['google_cloud_sql', ['google_sql_database_instance']],
  ['google_cloud_run', ['google_cloud_run_service']],
]);

export function verifyServiceMappingExists(services: string[]): void {
  if (services.length == 0) {
    throw new InvalidServiceError('');
  }
  for (const s of services) {
    if (!services2resources.has(s)) {
      throw new InvalidServiceError(
        `We were unable to match service "${s}". Please provide a valid service name: ${existingServiceNames()}`,
      );
    }
  }
}

function existingServiceNames(): string {
  let res = '';
  for (const s of services2resources.keys()) {
    res += `${s},`;
  }
  return res.substring(0, res.length - 1);
}

export function createIgnorePattern(services: string[]): string {
  return createIgnorePatternWithMap(services, services2resources);
}

export function createIgnorePatternWithMap(
  services: string[],
  serviceMap: Map<string, Array<string>>,
): string {
  let res = '*';
  const seenResources = new Set<string>();
  for (const s of services) {
    const resourcePatterns = serviceMap.get(s);
    for (const rp of resourcePatterns || []) {
      // A resource might belong to multiple services, skip it if already processed
      if (seenResources.has(rp)) {
        continue;
      }
      res += `,!${rp}`;
      seenResources.add(rp);
    }
  }
  return res;
}

export class InvalidServiceError extends CustomError {
  constructor(msg: string) {
    super(msg);
    this.code = IaCErrorCodes.InvalidServiceError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
  }
}
