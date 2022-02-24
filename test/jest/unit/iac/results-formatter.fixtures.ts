import * as path from 'path';
import {
  EngineType,
  IacFileScanResult,
  PolicyMetadata,
  TestMeta,
} from '../../../../src/cli/commands/test/iac-local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';
import { SEVERITY } from '../../../../src/lib/snyk-test/common';
import { AnnotatedIacIssue } from '../../../../src/lib/snyk-test/iac-test-result';

export const policyStub: PolicyMetadata = {
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
};

export const anotherPolicyStub: PolicyMetadata = {
  ...policyStub,
  severity: 'high' as SEVERITY,
  id: '2',
  publicId: 'SNYK-CC-K8S-2',
};

export const yetAnotherPolicyStub: PolicyMetadata = {
  ...anotherPolicyStub,
  id: '3',
  publicId: 'SNYK-CC-K8S-3',
};

const relativeFilePath = 'dont-care.yaml';
const absoluteFilePath = path.resolve(relativeFilePath, '.');

export function generateScanResults({
  engineType = EngineType.Kubernetes,
} = {}): Array<IacFileScanResult> {
  return [
    {
      violatedPolicies: [{ ...policyStub }],
      jsonContent: { dontCare: null },
      docId: 0,
      projectType: IacProjectType.K8S,
      engineType,
      fileContent: 'dont-care',
      filePath: relativeFilePath,
      fileType: 'yaml',
    },
    {
      violatedPolicies: [{ ...anotherPolicyStub }],
      jsonContent: { dontCare: null },
      docId: 0,
      projectType: IacProjectType.K8S,
      engineType,
      fileContent: 'dont-care',
      filePath: relativeFilePath,
      fileType: 'yaml',
    },
    {
      violatedPolicies: [{ ...yetAnotherPolicyStub }],
      jsonContent: { dontCare: null },
      docId: 1,
      projectType: IacProjectType.K8S,
      engineType,
      fileContent: 'dont-care',
      filePath: relativeFilePath,
      fileType: 'yaml',
    },
  ];
}

export const meta: TestMeta = {
  isPrivate: false,
  isLicensesEnabled: false,
  org: 'org-name',
};

export function generateCloudConfigResults({
  withLineNumber = true,
  isGeneratedByCustomRule = false,
} = {}): AnnotatedIacIssue[] {
  return [
    {
      ...anotherPolicyStub,
      id: anotherPolicyStub.publicId,
      name: anotherPolicyStub.title,
      cloudConfigPath: ['[DocId: 0]'].concat(anotherPolicyStub.msg.split('.')),
      isIgnored: false,
      iacDescription: {
        issue: anotherPolicyStub.issue,
        impact: anotherPolicyStub.impact,
        resolve: anotherPolicyStub.resolve,
      },
      severity: anotherPolicyStub.severity,
      lineNumber: withLineNumber ? 3 : -1,
      documentation: !isGeneratedByCustomRule
        ? 'https://snyk.io/security-rules/SNYK-CC-K8S-2'
        : undefined,
      isGeneratedByCustomRule,
    },
    {
      ...yetAnotherPolicyStub,
      id: yetAnotherPolicyStub.publicId,
      name: yetAnotherPolicyStub.title,
      cloudConfigPath: ['[DocId: 1]'].concat(
        yetAnotherPolicyStub.msg.split('.'),
      ),
      isIgnored: false,
      iacDescription: {
        issue: yetAnotherPolicyStub.issue,
        impact: yetAnotherPolicyStub.impact,
        resolve: yetAnotherPolicyStub.resolve,
      },
      severity: yetAnotherPolicyStub.severity,
      lineNumber: withLineNumber ? 3 : -1,
      documentation: !isGeneratedByCustomRule
        ? 'https://snyk.io/security-rules/SNYK-CC-K8S-3'
        : undefined,
      isGeneratedByCustomRule,
    },
  ];
}

function generateFormattedResults(options) {
  return {
    result: {
      cloudConfigResults: generateCloudConfigResults(
        options.cloudConfigResultsOptions ?? {},
      ),
      projectType: 'k8sconfig',
    },
    isPrivate: true,
    packageManager: options.packageManager ?? IacProjectType.K8S,
    targetFile: relativeFilePath,
    targetFilePath: absoluteFilePath,
    vulnerabilities: [],
    dependencyCount: 0,
    ignoreSettings: null,
    licensesPolicy: null,
    projectName: 'snyk',
    meta: {
      ...meta,
      policy: '',
      projectId: undefined,
    },
    org: meta.org,
    policy: '',
    filesystemPolicy: false,
  };
}

export const expectedFormattedResultsWithLineNumber = generateFormattedResults({
  cloudConfigResultsOptions: {
    withLineNumber: true,
  },
});
export const expectedFormattedResultsWithoutLineNumber = generateFormattedResults(
  {
    cloudConfigResultsOptions: {
      withLineNumber: false,
    },
  },
);
export const expectedFormattedResultsGeneratedByCustomRules = generateFormattedResults(
  {
    cloudConfigResultsOptions: {
      isGeneratedByCustomRule: true,
    },
    packageManager: IacProjectType.CUSTOM,
  },
);
