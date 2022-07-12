import {
  IacShareResultsFormat,
  IaCTestFlags,
  PolicyMetadata,
} from '../../cli/commands/test/iac/local-execution/types';
import { ScanResult } from '../ecosystems/types';
import { Policy } from '../policy/find-and-load-policy';
import { IacOutputMeta } from '../types';

export function convertIacResultToScanResult(
  iacResult: IacShareResultsFormat,
  policy: Policy | undefined,
  meta: IacOutputMeta,
  options?: IaCTestFlags,
): ScanResult {
  return {
    identity: {
      type: iacResult.projectType,
      targetFile: iacResult.targetFile,
    },
    facts: [],
    findings: iacResult.violatedPolicies.map((policy: PolicyMetadata) => {
      return {
        data: { metadata: policy, docId: policy.docId },
        type: 'iacIssue',
      };
    }),
    name: iacResult.projectName,
    target: buildTarget(meta),
    policy: policy?.toString() ?? '',
    targetReference: options?.['target-reference'],
  };
}

function buildTarget(meta: IacOutputMeta) {
  if (meta.gitRemoteUrl) {
    return { remoteUrl: meta.gitRemoteUrl };
  }
  return { name: meta.projectName };
}
