import { Options } from '../types';
import { spinner } from '../../lib/spinner';
import { Ecosystem, ScanResult, TestResult } from './types';
import {
  requestTestPollingToken,
  pollingTestWithTokenUntilDone,
} from '../polling/polling-test';
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
        const res = await requestTestPollingToken(options, true, scanResult);
        if (scanResult.analytics) {
          extractAndApplyPluginAnalytics(scanResult.analytics, res.token);
        }
        const { maxAttempts, pollInterval } = res.pollingTask;
        const attemptsCount = 0;
        const response = await pollingTestWithTokenUntilDone(
          res.token,
          ecosystem,
          options,
          pollInterval,
          attemptsCount,
          maxAttempts,
        );
        results.push({
          issues: response?.issues,
          issuesData: response?.issuesData,
          depGraphData: response?.depGraphData,
          depsFilePaths: response?.depsFilePaths,
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
