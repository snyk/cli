import { Options } from '../types';
import * as spinner from '../../lib/spinner';
import { Ecosystem, ScanResult, TestResult } from './types';
import { pollingWithTokenUntilDone, requestPollingToken } from './polling';
import { extractAndApplyPluginAnalytics } from './plugin-analytics';

export async function resolveAndTestFacts(
  ecosystem: Ecosystem,
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options,
): Promise<[TestResult[], string[]]> {
  const results: any[] = [];
  const errors: string[] = [];

  for (const [path, scanResults] of Object.entries(scans)) {
    await spinner(`Resolving and Testing fileSignatures in ${path}`);
    for (const scanResult of scanResults) {
      try {
        if (scanResult.analytics) {
          extractAndApplyPluginAnalytics(scanResult.analytics);
        }
        const res = await requestPollingToken(options, true, scanResult);
        const { maxAttempts, pollInterval } = res.pollingTask;
        const attemptsCount = 0;
        const response = await pollingWithTokenUntilDone(
          res.token,
          ecosystem,
          options,
          pollInterval,
          attemptsCount,
          maxAttempts,
        );
        results.push({
          issues: response?.result?.issues,
          issuesData: response?.result?.issuesData,
          depGraphData: response?.result?.depGraphData,
        });
      } catch (error) {
        const hasStatusCodeError = error.code >= 400 && error.code <= 500;
        if (hasStatusCodeError) {
          errors.push(error.message);
          continue;
        }
        const failedPath = path ? `in ${path}` : '.';
        errors.push(`Could not test dependencies ${failedPath}`);
      }
    }
  }
  spinner.clearAll();
  return [results, errors];
}
