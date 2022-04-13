import { FormattedResult } from '../../../../cli/commands/test/iac/local-execution/types';
import { IacOutputMeta } from '../../../types';
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
    oldFormattedResult.result.cloudConfigResults.forEach((policyMetadata) => {
      if (!newFormattedResults.results[policyMetadata.severity]) {
        newFormattedResults.results[policyMetadata.severity] = [];
      }
      newFormattedResults.results[policyMetadata.severity].push({
        policyMetadata,
        targetFile: oldFormattedResult.targetFile,
        targetFilePath: oldFormattedResult.targetFilePath,
      });
    });
  });

  return newFormattedResults;
}
