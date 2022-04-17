import { FormattedResult } from '../../../../../cli/commands/test/iac/local-execution/types';
import { IacOutputMeta } from '../../../../types';
import { IacTestOutput } from './types';

export function formatScanResultsNewOutput(
  oldFormattedResults: FormattedResult[],
  outputMeta: IacOutputMeta,
): IacTestOutput {
  const newFormattedResults: IacTestOutput = {
    results: {},
    metadata: outputMeta,
  };

  oldFormattedResults.forEach((oldFormattedResult) => {
    oldFormattedResult.result.cloudConfigResults.forEach((issue) => {
      if (!newFormattedResults.results[issue.severity]) {
        newFormattedResults.results[issue.severity] = [];
      }

      newFormattedResults.results[issue.severity].push({
        issue,
        targetFile: oldFormattedResult.targetFile,
        projectType: oldFormattedResult.result.projectType,
      });
    });
  });

  return newFormattedResults;
}
