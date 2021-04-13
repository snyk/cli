import {
  EngineType,
  IacFileScanResult,
  PolicyMetadata,
} from '../../../../src/cli/commands/test/iac-local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';
import { SEVERITY } from '../../../../src/lib/snyk-test/common';

const policyStub: PolicyMetadata = {
  id: '1',
  description: '',
  impact:
    'Compromised container could potentially modify the underlying host’s kernel by loading unauthorized modules (i.e. drivers).',
  issue: 'Container is running in privileged mode',
  msg: 'input.spec.containers[whatever].securityContext.privileged',
  policyEngineType: 'opa',
  publicId: 'SNYK-CC-K8S-1',
  references: [
    'CIS Kubernetes Benchmark 1.6.0 - 5.2.1 Minimize the admission of privileged containers',
    'https://kubernetes.io/docs/concepts/policy/pod-security-policy/#privileged',
    'https://kubernetes.io/blog/2016/08/security-best-practices-kubernetes-deployment/',
  ],
  resolve:
    'Remove `securityContext.privileged` attribute, or set value to `false`',
  severity: 'medium' as SEVERITY,
  subType: 'Deployment',
  title: 'Container is running in privileged mode',
  type: 'k8s',
};

const anotherPolicyStub: PolicyMetadata = {
  ...policyStub,
  severity: 'high' as SEVERITY,
  id: '2',
  publicId: 'SNYK-CC-K8S-2',
};

export const scanResults: Array<IacFileScanResult> = [
  {
    violatedPolicies: [policyStub],
    jsonContent: { dontCare: null },
    docId: 0,
    engineType: EngineType.Kubernetes,
    fileContent: 'dont-care',
    filePath: 'dont-care',
    fileType: 'yaml',
  },
  {
    violatedPolicies: [anotherPolicyStub],
    jsonContent: { dontCare: null },
    docId: 0,
    engineType: EngineType.Kubernetes,
    fileContent: 'dont-care',
    filePath: 'dont-care',
    fileType: 'yaml',
  },
];

export const expectedFormattedResults = {
  result: {
    cloudConfigResults: [
      {
        ...anotherPolicyStub,
        id: anotherPolicyStub.publicId,
        name: anotherPolicyStub.title,
        cloudConfigPath: ['[DocId:0]'].concat(anotherPolicyStub.msg.split('.')),
        isIgnored: false,
        iacDescription: {
          issue: anotherPolicyStub.issue,
          impact: anotherPolicyStub.impact,
          resolve: anotherPolicyStub.resolve,
        },
        severity: anotherPolicyStub.severity,
        lineNumber: 3,
      },
    ],
  },
  isPrivate: true,
  packageManager: IacProjectType.K8S,
  targetFile: 'dont-care',
};
