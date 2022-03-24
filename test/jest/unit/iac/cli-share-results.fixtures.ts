import {
  IacShareResultsFormat,
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
  docId: 0,
};

const anotherPolicyStub: PolicyMetadata = {
  ...policyStub,
  severity: 'high' as SEVERITY,
  id: '2',
  publicId: 'SNYK-CC-K8S-2',
  docId: 1,
};

export const scanResults: IacShareResultsFormat[] = [
  {
    projectName: 'projectA',
    targetFile: 'file.yaml',
    filePath: '/some/path/to/file.yaml',
    fileType: 'yaml',
    projectType: IacProjectType.K8S,
    violatedPolicies: [{ ...policyStub }, { ...anotherPolicyStub }],
  },
  {
    projectName: 'projectB',
    targetFile: 'file.yaml',
    filePath: '/some/path/to/file.yaml',
    fileType: 'yaml',
    projectType: IacProjectType.K8S,
    violatedPolicies: [{ ...policyStub }],
  },
];

export const expectedEnvelopeFormatterResults = [
  {
    identity: {
      type: 'k8sconfig',
      targetFile: 'file.yaml',
    },
    facts: [],
    findings: [
      {
        data: {
          metadata: {
            id: '1',
            description: '',
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
            severity: 'medium',
            subType: 'Deployment',
            title: 'Container is running in privileged mode',
            type: 'k8s',
            docId: 0,
          },
          docId: 0,
        },
        type: 'iacIssue',
      },
      {
        data: {
          metadata: {
            id: '2',
            description: '',
            impact:
              'Compromised container could potentially modify the underlying host’s kernel by loading unauthorized modules (i.e. drivers).',
            issue: 'Container is running in privileged mode',
            msg: 'input.spec.containers[whatever].securityContext.privileged',
            publicId: 'SNYK-CC-K8S-2',
            references: [
              'CIS Kubernetes Benchmark 1.6.0 - 5.2.1 Minimize the admission of privileged containers',
              'https://kubernetes.io/docs/concepts/policy/pod-security-policy/#privileged',
              'https://kubernetes.io/blog/2016/08/security-best-practices-kubernetes-deployment/',
            ],
            resolve:
              'Remove `securityContext.privileged` attribute, or set value to `false`',
            severity: 'high',
            subType: 'Deployment',
            title: 'Container is running in privileged mode',
            type: 'k8s',
            docId: 1,
          },
          docId: 1,
        },
        type: 'iacIssue',
      },
    ],
    name: 'projectA',
    policy: '',
    target: {
      remoteUrl: 'http://github.com/snyk/cli.git',
      branch: 'master',
    },
  },
  {
    identity: {
      type: 'k8sconfig',
      targetFile: 'file.yaml',
    },
    facts: [],
    findings: [
      {
        data: {
          metadata: {
            id: '1',
            description: '',
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
            severity: 'medium',
            subType: 'Deployment',
            title: 'Container is running in privileged mode',
            type: 'k8s',
            docId: 0,
          },
          docId: 0,
        },
        type: 'iacIssue',
      },
    ],
    name: 'projectB',
    policy: '',
    target: {
      remoteUrl: 'http://github.com/snyk/cli.git',
      branch: 'master',
    },
  },
];

export const expectedEnvelopeFormatterResultsWithPolicy = expectedEnvelopeFormatterResults.map(
  (result) => {
    return {
      ...result,
      policy: `# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.24.0
# ignores vulnerabilities until expiry date; change duration by modifying expiry date
ignore:
  SNYK-CC-TF-4:
    - '*':
        reason: IGNORE ALL THE THINGS!
patch: {}
`,
    };
  },
);
