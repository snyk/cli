import { spinner } from '../../lib/spinner';
import { sleep } from '../common';
import { AuthFailedError } from '../errors';
import { findAndLoadPolicy } from '../policy';
import {
  createDepGraph,
  getDepGraph,
  getIssues,
  pollingTestWithTokenUntilDone,
  requestTestPollingToken,
} from '../polling/polling-test';
import { SEVERITY } from '../snyk-test/common';
import { Issue, IssueDataUnmanaged } from '../snyk-test/legacy';
import { Options, PolicyOptions, SupportedProjectTypes } from '../types';
import { extractAndApplyPluginAnalytics } from './plugin-analytics';
import { filterIgnoredIssues } from './policy';
import {
  Ecosystem,
  FileSignaturesDetails,
  ScanResult,
  TestResult,
} from './types';
import {
  Attributes,
  CreateDepGraphResponse,
  FileHashes,
  GetIssuesResponse,
} from './unmanaged/types';
import {
  convertDepGraph,
  convertMapCasing,
  convertToCamelCase,
  getOrg,
} from './unmanaged/utils';

export async function resolveAndTestFacts(
  ecosystem: Ecosystem,
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options & PolicyOptions,
): Promise<[TestResult[], string[]]> {
  try {
    return await resolveAndTestFactsUnmanagedDeps(scans, options);
  } catch (error) {
    const unauthorizedErrorCode = error.code === 401 || error.code === 403;
    const missingApiToken = error.isMissingApiToken;

    // Decide if the error is an authorization error other than being
    // unauthenticated (missing or invalid API token). An account lacking
    // permission, for example.
    const otherUnauthorized = unauthorizedErrorCode && !missingApiToken;
    if (otherUnauthorized) {
      throw AuthFailedError(
        'Unauthorized request to unmanaged service',
        error.code,
      );
    }

    throw error;
  }
}

export async function submitHashes(
  hashes: FileHashes,
  orgId: string,
): Promise<string> {
  const response: CreateDepGraphResponse = await createDepGraph(hashes, orgId);

  return response.data.id;
}

export async function pollDepGraphAttributes(
  id: string,
  orgId: string,
): Promise<Attributes> {
  const minIntervalMs = 2000;
  const maxIntervalMs = 20000;

  let totalElaspedTime = 0;
  let attempts = 1;
  const maxElapsedTime = 1800000; // 30 mins in ms

  // Loop until we receive a response that is not in progress,
  // or we receive something else than http status code 200.
  while (totalElaspedTime <= maxElapsedTime) {
    const graph = await getDepGraph(id, orgId);

    if (graph.data.attributes.in_progress) {
      const pollInterval = Math.min(minIntervalMs * attempts, maxIntervalMs);
      await sleep(pollInterval);

      totalElaspedTime += pollInterval;
      attempts++;
      continue;
    }

    return graph.data.attributes;
  }

  throw new Error('max retries reached');
}

async function fetchIssues(
  start_time,
  dep_graph_data,
  component_details,
  target_severity: SEVERITY,
  orgId: string,
) {
  const response: GetIssuesResponse = await getIssues(
    {
      dep_graph: dep_graph_data,
      start_time,
      component_details,
      target_severity,
    },
    orgId,
  );

  const issues = response.data.result.issues.map((issue) => {
    const converted = convertToCamelCase<Issue>(issue);
    converted.fixInfo = convertToCamelCase(converted.fixInfo);
    return converted;
  });

  const issuesData = convertMapCasing<{
    [issueId: string]: IssueDataUnmanaged;
  }>(response.data.result.issues_data);

  const depGraphData = convertDepGraph(response.data.result.dep_graph);

  const dependencyCount = response.data.result.dep_graph.graph.nodes.find(
    (graphNode) => {
      return graphNode.node_id === 'root-node';
    },
  )?.deps?.length;

  const depsFilePaths = response.data.result.deps_file_paths;

  const fileSignaturesDetails = convertMapCasing<FileSignaturesDetails>(
    response.data.result.file_signatures_details,
  );

  return {
    issues,
    issuesData,
    depGraphData,
    dependencyCount,
    depsFilePaths,
    fileSignaturesDetails,
  };
}

function buildVulnerabilityFromIssue(
  issueData: IssueDataUnmanaged,
  issue: Issue,
  packageManager: SupportedProjectTypes,
): IssueDataUnmanaged {
  const pkgCoordinate = `${issue.pkgName}@${issue.pkgVersion}`;
  issueData.from = [pkgCoordinate];
  issueData.name = pkgCoordinate;
  issueData.packageManager = packageManager;
  issueData.version = issue.pkgVersion || '';
  issueData.upgradePath = [false];
  issueData.isPatchable = false;
  return issueData;
}

export async function resolveAndTestFactsUnmanagedDeps(
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options & PolicyOptions,
): Promise<[TestResult[], string[]]> {
  const results: any[] = [];
  const errors: string[] = [];
  const packageManager = 'Unmanaged (C/C++)';
  const displayTargetFile = '';

  const orgId = await getOrg(options.org);
  const target_severity: SEVERITY = options.severityThreshold || SEVERITY.LOW;

  if (orgId === '') {
    errors.push('organisation-id missing');
    return [results, errors];
  }

  for (const [path, scanResults] of Object.entries(scans)) {
    await spinner(`Resolving and Testing fileSignatures in ${path}`);

    for (const scanResult of scanResults) {
      try {
        const id = await submitHashes(
          { hashes: scanResult?.facts[0]?.data },
          orgId,
        );

        if (scanResult.analytics) {
          extractAndApplyPluginAnalytics(scanResult.analytics, id);
        }

        const { start_time, dep_graph_data, component_details } =
          await pollDepGraphAttributes(id, orgId);

        const {
          issues,
          issuesData,
          depGraphData,
          dependencyCount,
          depsFilePaths,
          fileSignaturesDetails,
        } = await fetchIssues(
          start_time,
          dep_graph_data,
          component_details,
          target_severity,
          orgId,
        );

        const issuesMap = new Map<string, Issue>();
        issues.forEach((i) => {
          issuesMap.set(i.issueId, i);
        });

        const policy = await findAndLoadPolicy(path, 'cpp', options);

        const [issuesFiltered, issuesDataFiltered] = filterIgnoredIssues(
          issues,
          issuesData,
          policy,
        );

        // Build vulnerabilities array from filtered data.
        const vulnerabilities: IssueDataUnmanaged[] = [];
        for (const issuesDataKey in issuesDataFiltered) {
          const issue = issuesMap.get(issuesDataKey);
          if (issue) {
            const issueData = issuesDataFiltered[
              issuesDataKey
            ] as IssueDataUnmanaged;
            vulnerabilities.push(
              buildVulnerabilityFromIssue(issueData, issue, packageManager),
            );
          }
        }

        // Build filtered.ignore array with ignored vulnerabilities
        const filteredIgnore: IssueDataUnmanaged[] = [];
        for (const issuesDataKey in issuesData) {
          // If the issue was in the original data but not in the filtered data, it was ignored
          if (!(issuesDataKey in issuesDataFiltered)) {
            const issue = issuesMap.get(issuesDataKey);
            if (issue) {
              const issueData = {
                ...issuesData[issuesDataKey],
              } as IssueDataUnmanaged;
              filteredIgnore.push(
                buildVulnerabilityFromIssue(issueData, issue, packageManager),
              );
            }
          }
        }

        extractAndApplyPluginAnalytics([
          {
            name: 'packageManager',
            data: depGraphData?.pkgManager?.name ?? '',
          },
          {
            name: 'unmanagedDependencyCount',
            data: dependencyCount ?? 0,
          },
          {
            name: 'unmanagedIssuesCount',
            data: issues.length ?? 0,
          },
        ]);

        results.push({
          issues: issuesFiltered,
          issuesData: issuesDataFiltered,
          depGraphData,
          depsFilePaths,
          fileSignaturesDetails,
          vulnerabilities,
          path,
          dependencyCount,
          packageManager,
          displayTargetFile,
          filtered: {
            ignore: filteredIgnore,
          },
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

// resolveAndTestFactsRegistry has been deprecated, and will be removed in upcoming release.
export async function resolveAndTestFactsRegistry(
  ecosystem: Ecosystem,
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options & PolicyOptions,
): Promise<[TestResult[], string[]]> {
  const results: any[] = [];
  const errors: string[] = [];
  const packageManager = 'Unmanaged (C/C++)';
  const displayTargetFile = '';

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

        const issuesMap = new Map<string, Issue>();
        response.issues.forEach((i) => {
          issuesMap.set(i.issueId, i);
        });

        const vulnerabilities: IssueDataUnmanaged[] = [];
        for (const issuesDataKey in response.issuesData) {
          const issue = issuesMap.get(issuesDataKey);
          if (issue) {
            const issueData = response.issuesData[issuesDataKey];
            const pkgCoordinate = `${issue.pkgName}@${issue.pkgVersion}`;
            issueData.from = [pkgCoordinate];
            issueData.name = pkgCoordinate;
            issueData.packageManager = packageManager;
            issueData.version = issue.pkgVersion || '';
            issueData.upgradePath = [false];
            issueData.isPatchable = false;
            vulnerabilities.push(issueData);
          }
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
          displayTargetFile,
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
