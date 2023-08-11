import * as path from 'path';

import { SupportedPackageManagers } from '../package-managers';
import { findAndLoadPolicy } from '../policy';
import { Options, PolicyOptions } from '../types';
import { Issue, IssuesData, ScanResult } from './types';
import { Policy } from '../policy/find-and-load-policy';

export async function findAndLoadPolicyForScanResult(
  scanResult: ScanResult,
  options: Options & PolicyOptions,
): Promise<object | undefined> {
  const targetFileRelativePath = scanResult.identity.targetFile
    ? path.join(path.resolve(`${options.path}`), scanResult.identity.targetFile)
    : undefined;
  const targetFileDir = targetFileRelativePath
    ? path.parse(targetFileRelativePath).dir
    : undefined;
  const scanType = options.docker
    ? 'docker'
    : (scanResult.identity.type as SupportedPackageManagers);
  // TODO: fix this and send only send when we used resolve-deps for node
  // it should be a ExpandedPkgTree type instead
  const packageExpanded = undefined;

  const policy = (await findAndLoadPolicy(
    options.path,
    scanType,
    options,
    packageExpanded,
    targetFileDir,
  )) as object | undefined; // TODO: findAndLoadPolicy() does not return a string!
  return policy;
}

export function filterIgnoredIssues(
  issues: Issue[],
  issuesData: IssuesData,
  policy?: Policy,
): [Issue[], IssuesData] {
  if (!policy?.ignore) {
    return [issues, issuesData];
  }

  const upperCaseKeys = (obj) => {
    return Object.keys(obj).reduce((acc, k) => {
      acc[k.toUpperCase()] = obj[k];
      return acc;
    }, {});
  };

  const policyIgnoreKeyUpperCased = upperCaseKeys({ ...policy.ignore });

  const issuesDataCopy = { ...issuesData };
  const returnUnfilteredIssuesData =
    !issues?.length || !Object.keys(policy.ignore)?.length;
  let filteredIssuesData = returnUnfilteredIssuesData ? issuesDataCopy : {};

  const filteredIssues: Issue[] = issues.filter((issue) => {
    const existingIgnoredVulnID = Object.keys(policyIgnoreKeyUpperCased)
      .find((key) => key === issue?.issueId.toUpperCase())
      ?.toUpperCase();

    if (!existingIgnoredVulnID) {
      return true;
    }

    const allResourcesRule = policyIgnoreKeyUpperCased[
      existingIgnoredVulnID
    ].find((element) => '*' in element);
    if (!allResourcesRule) {
      return true;
    }

    const expiredIgnoreRule =
      new Date(allResourcesRule['*'].expires) < new Date();
    if (!expiredIgnoreRule) {
      filteredIssuesData = Object.keys(issuesDataCopy).reduce((acc, key) => {
        if (!policyIgnoreKeyUpperCased[key.toUpperCase()]) {
          acc[key] = issuesDataCopy[key];
        }
        return acc;
      }, {});
      return false;
    } else {
      filteredIssuesData = issuesDataCopy;
    }

    return true;
  });

  return [filteredIssues, filteredIssuesData];
}
