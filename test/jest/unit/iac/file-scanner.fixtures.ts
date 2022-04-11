import {
  EngineType,
  IacFileParsed,
  PolicyMetadata,
} from '../../../../src/cli/commands/test/iac/local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';
import { SEVERITY } from '../../../../src/lib/snyk-test/common';

export const expectedViolatedPoliciesForK8s: Array<PolicyMetadata> = [
  {
    description: '',
    id: '1',
    impact:
      'Compromised container could potentially modify the underlying host’s kernel by loading unauthorized modules (i.e. drivers).',
    issue: 'Container is running in privileged mode',
    msg: 'input.spec.containers[whatever].securityContext.privileged',
    publicId: 'SNYK-CC-K8S-1',
    references: [
      'CIS Kubernetes Benchmark 1.6.0 - 5.2.1 Minimize the admission of privileged containers',
      'https://kubernetes.io/docs/concepts/policy/pod-security-policy/#privileged',
      'https://kubernetes.io/blog/2016/08/security-best-practices-kubernetes-deployment/',
    ],
    resolve:
      'Remove `securityContext.privileged` attribute, or set value to `false`',
    severity: 'high' as SEVERITY,
    subType: 'Deployment',
    title: 'Container is running in privileged mode',
    type: 'k8s',
  },
];

export const expectedViolatedPoliciesForTerraform: Array<PolicyMetadata> = [
  {
    description:
      '## Overview\nUsing Terraform, the `aws_security_group` resource is used to restrict networking to and from different resources.\nWhen the ingress "cidr_blocks" is set to ["0.0.0.0/0"] or ["::/0"] potentially meaning everyone can access your resource.\n\n## Remediation\nThe aws_security_group ingress.cidr_block property should be populated with a specific IP range or address.\n\n## References\nad\n\n',
    id: '101',
    impact: 'That potentially everyone can access your resource',
    issue:
      'That inbound traffic is allowed to a resource from any source instead of a restricted range',
    msg: 'input.resource.aws_security_group[allow_ssh].ingress[0]',
    publicId: 'SNYK-CC-TF-1',
    references: [],
    resolve:
      'Updating the `cidr_block` attribute with a more restrictive IP range or a specific IP address to ensure traffic can only come from known sources. ',
    severity: 'medium' as SEVERITY,
    subType: 'Security Group',
    title: 'Security Group allows open ingress',
    type: 'terraform',
  },
];

export const paresdKubernetesFileStub: IacFileParsed = {
  engineType: EngineType.Kubernetes,
  projectType: IacProjectType.K8S,
  fileContent: 'dont-care',
  filePath: 'dont-care',
  fileType: 'yml',
  jsonContent: {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name: 'myapp-pod',
    },
    spec: {
      containers: [
        {
          name: 'whatever',
          securityContext: {
            privileged: true,
          },
        },
      ],
    },
  },
};
export const parsedTerraformFileStub: IacFileParsed = {
  engineType: EngineType.Terraform,
  projectType: IacProjectType.TERRAFORM,
  fileContent: 'dont-care',
  filePath: 'dont-care',
  fileType: 'tf',
  jsonContent: {
    resource: {
      aws_security_group: {
        allow_ssh: {
          description: 'Allow SSH inbound from anywhere',
          ingress: [
            {
              cidr_blocks: ['0.0.0.0/0'],
              from_port: 22,
              protocol: 'tcp',
              to_port: 22,
            },
          ],
          name: 'allow_ssh',
          vpc_id: '${aws_vpc.main.id}',
        },
      },
    },
  },
};

export const parsedArmFileStub: IacFileParsed = {
  engineType: EngineType.ARM,
  projectType: IacProjectType.ARM,
  fileContent: 'dont-care',
  filePath: 'dont-care',
  fileType: 'json',
  jsonContent: {
    $schema:
      'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
    contentVersion: '1.0.0.0',
    parameters: {},
    resources: [
      {
        type: 'Microsoft.ServiceFabric/clusters',
        apiVersion: '2021-06-01',
        name: 'denied',
        properties: {},
      },
      {
        type: 'Microsoft.ServiceFabric/clusters',
        apiVersion: '2021-06-01',
        name: 'allowed',
        properties: {
          azureActiveDirectory: {},
        },
      },
    ],
  },
};

export const expectedViolatedPoliciesForArm: Array<PolicyMetadata> = [
  {
    severity: 'medium' as SEVERITY,
    resolve: 'Set an `azureActiveDirectory` attribute',
    impact:
      'Alternative certificate based authentication introduced management overhead. Certificates are harder to revoke and rotate than active directory membership',
    msg: 'resources[0].properties.azureActiveDirectory',
    remediation: {
      terraform:
        'Set an `azure_active_directory` block with the following attributes, `tenant_id`, `cluster_application_id`, `client_application_id`',
      arm: 'Set an `azureActiveDirectory` attribute',
    },
    subType: 'Service Fabric',
    issue: 'Service fabric does not use active directory authentication',
    publicId: 'SNYK-CC-AZURE-473',
    title: 'Service fabric does not use active directory authentication',
    references: [
      'https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/service_fabric_cluster',
      'https://docs.microsoft.com/en-us/azure/service-fabric/service-fabric-cluster-creation-setup-aad',
    ],
  },
];
