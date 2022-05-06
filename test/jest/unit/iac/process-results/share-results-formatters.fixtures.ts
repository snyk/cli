import * as path from 'path';
import {
  anotherPolicyStub,
  policyStub,
  yetAnotherPolicyStub,
} from '../results-formatter.fixtures';

const projectDirectoryName = path.basename(
  path.resolve(__dirname, '..', '..', '..', '..', '..'),
);

export const expectedFormattedResultsForShareResults = [
  {
    projectName: projectDirectoryName,
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
