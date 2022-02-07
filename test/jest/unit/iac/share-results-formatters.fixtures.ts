import {
  anotherPolicyStub,
  policyStub,
  yetAnotherPolicyStub,
} from './results-formatter.fixtures';

export const expectedFormattedResultsForShareResults = [
  {
    projectName: 'snyk',
    targetFile: 'dont-care.yaml',
    filePath: 'dont-care.yaml',
    fileType: 'yaml',
    projectType: 'k8sconfig',
    violatedPolicies: [
      { ...policyStub, docId: 0 },
      { ...anotherPolicyStub, docId: 0 },
      { ...yetAnotherPolicyStub, docId: 1 },
    ],
  },
];
