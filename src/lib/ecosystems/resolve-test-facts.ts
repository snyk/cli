import { Options, PolicyOptions } from '../types';
import { spinner } from '../../lib/spinner';
import { Ecosystem, ScanResult, TestResult } from './types';
import {
  requestTestPollingToken,
  pollingTestWithTokenUntilDone,
} from '../polling/polling-test';
import { extractAndApplyPluginAnalytics } from './plugin-analytics';
import { findAndLoadPolicy } from '../policy';
import { filterIgnoredIssues } from './policy';
import { IssueData, Issue } from '../snyk-test/legacy';

export async function resolveAndTestFacts(
  ecosystem: Ecosystem,
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options & PolicyOptions,
): Promise<[TestResult[], string[]]> {
  const results: any[] = [];
  const errors: string[] = [];
  const packageManager = 'Unmanaged (C/C++)';

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

        const policy = await findAndLoadPolicy(path, 'cpp', options);
        const [issues, issuesData] = filterIgnoredIssues(
          response.issues,
          response.issuesData,
          policy,
        );

        const issuesMap: Map<string, Issue> = new Map();
        response.issues.forEach((i) => {
          issuesMap[i.issueId] = i;
        });

        const vulnerabilities: IssueData[] = [];
        for (const issuesDataKey in response.issuesData) {
          const issueData = response.issuesData[issuesDataKey];
          const pkgCoordinate = `${issuesMap[issuesDataKey].pkgName}@${issuesMap[issuesDataKey].pkgVersion}`;
          issueData.from = [pkgCoordinate];
          issueData.name = pkgCoordinate;
          issueData.packageManager = packageManager;
          vulnerabilities.push(issueData);
        }

        const dependencyCount = response?.depGraphData?.graph?.nodes?.find(
          (graphNode) => {
            return graphNode.nodeId === 'root-node';
          },
        )?.deps?.length;

        results.push({
          issues,
          issuesData,
          depGraphData: response?.depGraphData,
          depsFilePaths: response?.depsFilePaths,
          fileSignaturesDetails: response?.fileSignaturesDetails,
          vulnerabilities,
          path,
          dependencyCount,
          packageManager,
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
