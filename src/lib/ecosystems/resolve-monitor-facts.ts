import { Contributor, Options } from '../types';
import { spinner } from '../../lib/spinner';
import {
  ScanResult,
  EcosystemMonitorError,
  EcosystemMonitorResult,
} from './types';
import {
  requestMonitorPollingToken,
  pollingMonitorWithTokenUntilDone,
} from '../polling/polling-monitor';
import { extractAndApplyPluginAnalytics } from './plugin-analytics';
import { AuthFailedError } from '../errors';
import { extractResolutionMetaFromScanResult } from '../polling/common';
import { UnableToCreateMonitorError } from '@snyk/error-catalog-nodejs-public/src/catalogs/CLI-error-catalog';

export async function resolveAndMonitorFacts(
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options,
  contributors?: Contributor[],
): Promise<[EcosystemMonitorResult[], EcosystemMonitorError[]]> {
  const results: EcosystemMonitorResult[] = [];
  const errors: EcosystemMonitorError[] = [];

  for (const [path, scanResults] of Object.entries(scans)) {
    await spinner(`Resolving and Monitoring fileSignatures in ${path}`);
    for (const scanResult of scanResults) {
      try {
        const res = await requestMonitorPollingToken(options, true, scanResult);
        if (scanResult.analytics) {
          extractAndApplyPluginAnalytics(scanResult.analytics, res.token);
        }
        const resolutionMeta = extractResolutionMetaFromScanResult(scanResult);
        const { maxAttempts, pollInterval } = res.pollingTask;
        const attemptsCount = 0;
        const response = await pollingMonitorWithTokenUntilDone(
          res.token,
          true,
          options,
          pollInterval,
          attemptsCount,
          maxAttempts,
          resolutionMeta,
          contributors,
        );

        const ecosystemMonitorResult: EcosystemMonitorResult = {
          ...response,
          path,
          scanResult,
        };

        results.push(ecosystemMonitorResult);
      } catch (error) {
        if (error.code === 401) {
          throw AuthFailedError();
        }

        if (error.code >= 400 && error.code < 500) {
          throw new UnableToCreateMonitorError(
            'Could not monitor dependencies in ' + path,
            error,
          );
        }
        errors.push({
          error: 'Could not monitor dependencies in ' + path,
          path,
          scanResult,
        });
      }
    }
    spinner.clearAll();
  }

  return [results, errors];
}
