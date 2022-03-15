import {
  GitInfo,
  IacShareResultsFormat,
  PolicyMetadata,
} from '../../cli/commands/test/iac-local-execution/types';
import { GitTarget, ScanResult } from '../ecosystems/types';
import { Policy } from '../policy/find-and-load-policy';

export function convertIacResultToScanResult(
    iacResult: IacShareResultsFormat,
    policy: Policy | undefined,
    gitInfo: GitInfo,
): ScanResult {
  return {
    identity: {
      type: iacResult.projectType,
      targetFile: iacResult.targetFile,
    },
    // TODO: should the contributors be under facts or under a new property?
    facts: [],
    findings: iacResult.violatedPolicies.map((policy: PolicyMetadata) => {
      return {
        data: { metadata: policy, docId: policy.docId },
        type: 'iacIssue',
      };
    }),
    name: iacResult.projectName,
    target:
      Object.keys(gitInfo.gitTarget).length === 0
        ? { name: iacResult.projectName }
        : { ...gitInfo.gitTarget, branch: 'master' },
    policy: policy?.toString() ?? '',
  };
}
