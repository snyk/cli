import { Options, PolicyOptions } from '../types';
import { spinner } from '../../lib/spinner';
import { ScanResult, TestResult, FileSignaturesDetails } from './types';
import {
  CreateDepGraphResponse,
  GetIssuesResponse,
  FileHashes,
  Attributes,
} from './unmanaged/types';
import {
  createDepGraph,
  getDepGraph,
  getIssues,
} from '../polling/polling-test';
import { extractAndApplyPluginAnalytics } from './plugin-analytics';
import { findAndLoadPolicy } from '../policy';
import { filterIgnoredIssues } from './policy';
import { IssueDataUnmanaged, Issue } from '../snyk-test/legacy';
import {
  convertDepGraph,
  convertMapCasing,
  convertToCamelCase,
  getSelf,
} from './unmanaged/utils';
import { sleep } from '../common';
import { SEVERITY } from '../snyk-test/common';

export async function resolveAndTestFacts(
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options & PolicyOptions,
): Promise<[TestResult[], string[]]> {
  const results: any[] = [];
  const errors: string[] = [];
  const packageManager = 'Unmanaged (C/C++)';
  const displayTargetFile = '';

  const orgId = options.org || (await getOrgDefaultContext()) || '';
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

        const {
          start_time,
          dep_graph_data,
          component_details,
        } = await pollDepGraphAttributes(id, orgId);

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

        const issuesMap: Map<string, Issue> = new Map();
        issues.forEach((i) => {
          issuesMap[i.issueId] = i;
        });

        const vulnerabilities: IssueDataUnmanaged[] = [];
        for (const issuesDataKey in issuesData) {
          const pkgCoordinate = `${issuesMap[issuesDataKey]?.pkgName}@${issuesMap[issuesDataKey]?.pkgVersion}`;
          const issueData = issuesData[issuesDataKey];

          issueData.from = [pkgCoordinate];
          issueData.name = pkgCoordinate;
          issueData.packageManager = packageManager;
          issueData.version = issuesMap[issuesDataKey]?.pkgVersion;
          issueData.upgradePath = [false];
          issueData.isPatchable = false;
          vulnerabilities.push(issueData);
        }

        const policy = await findAndLoadPolicy(path, 'cpp', options);

        const [issuesFiltered, issuesDataFiltered] = filterIgnoredIssues(
          issues,
          issuesData,
          policy,
        );

        extractAndApplyPluginAnalytics([
          {
            name: 'packageManager',
            data: depGraphData?.pkgManager?.name ?? '',
          },
          {
            name: 'unmanagedDependencyCount',
            data: depGraphData?.pkgs.length ?? 0,
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

async function getOrgDefaultContext(): Promise<string> {
  return (await getSelf())?.data.attributes.default_org_context;
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
