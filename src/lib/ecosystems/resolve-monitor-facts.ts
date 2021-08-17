import { Options } from '../types';
import * as spinner from '../../lib/spinner';
import {
  Ecosystem,
  ScanResult,
  EcosystemMonitorError,
  EcosystemMonitorResult,
} from './types';
import {
  requestMonitorPollingToken,
  pollingMonitorWithTokenUntilDone,
} from './polling/polling-monitor';
import { extractAndApplyPluginAnalytics } from './plugin-analytics';
import { AuthFailedError, MonitorError } from '../errors';

export async function resolveAndMonitorFacts(
  ecosystem: Ecosystem,
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options,
): Promise<[EcosystemMonitorResult[], EcosystemMonitorError[]]> {
  const results: EcosystemMonitorResult[] = [];
  const errors: EcosystemMonitorError[] = [];

  for (const [path, scanResults] of Object.entries(scans)) {
    await spinner(`Resolving and Monitoring fileSignatures in ${path}`);
    for (const scanResult of scanResults) {
      try {
        if (scanResult.analytics) {
          extractAndApplyPluginAnalytics(scanResult.analytics);
        }
        const res = await requestMonitorPollingToken(options, true, scanResult);
        const { maxAttempts, pollInterval } = res.pollingTask;
        const attemptsCount = 0;

        const response = await pollingMonitorWithTokenUntilDone(
          res.token,
          ecosystem,
          options,
          pollInterval,
          attemptsCount,
          maxAttempts,
          res.resolutionMeta,
        );

        if (response) {
          results.push({ ...(response as any), path, scanResult });
        }
      } catch (error) {
        if (error.code === 401) {
          throw AuthFailedError();
        }
        if (error.code >= 400 && error.code < 500) {
          throw new MonitorError(error.code, error.message);
        }

        errors.push({
          error: 'Could not monitor dependencies in ' + path,
          path,
          scanResult,
        });
      }
    }
  }
  spinner.clearAll();
  return [results, errors];
}
