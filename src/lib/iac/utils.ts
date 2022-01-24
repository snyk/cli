import { FormattedResult } from '../../cli/commands/test/iac-local-execution/types';
import { ScanResult } from '../ecosystems/types';

export function convertIacResultsToScanResult(
  iacResult: FormattedResult,
): ScanResult {
  return {
    identity: {
      type: iacResult.packageManager,
      targetFile: iacResult.targetFile,
    },
    facts: [{ data: iacResult.result.cloudConfigResults, type: 'iacIssues' }],
    name: iacResult.projectName,
    target: {
      remoteUrl: 'http://github.com/YairZ101/private_iac_goof.git',
      branch: 'master',
    },
  };
}
