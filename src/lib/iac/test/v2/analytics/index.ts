import { policyEngineReleaseVersion } from '../local-cache/policy-engine/constants';
import { ResourceKind, TestOutput } from '../scan/results';
import * as analytics from '../../../../../lib/analytics';
import { getIacType, IacType } from './iac-type';

export interface IacAnalytics {
  iacType: IacType;
  packageManager: ResourceKind[];
  iacIssuesCount: number;
  iacIgnoredIssuesCount: number;
  iacFilesCount: number;
  iacResourcesCount: number;
  iacErrorCodes: number[];
  iacTestBinaryVersion: string;
  // iacRulesBundleVersion: string; // TODO: Add when we have the rules bundle version
}

export function addIacAnalytics(testOutput: TestOutput): void {
  const iacAnalytics = computeIacAnalytics(testOutput);

  analytics.add('iac-type', iacAnalytics.iacType);
  analytics.add('packageManager', iacAnalytics.packageManager);
  analytics.add('iac-issues-count', iacAnalytics.iacIssuesCount);
  analytics.add('iac-ignored-issues-count', iacAnalytics.iacIgnoredIssuesCount);
  analytics.add('iac-files-count', iacAnalytics.iacFilesCount);
  analytics.add('iac-resources-count', iacAnalytics.iacResourcesCount);
  analytics.add('iac-error-codes', iacAnalytics.iacErrorCodes);
  analytics.add('iac-test-binary-version', iacAnalytics.iacTestBinaryVersion);
}

function computeIacAnalytics(testOutput: TestOutput): IacAnalytics {
  const iacType = getIacType(testOutput);

  return {
    iacType,
    packageManager: Object.keys(iacType) as ResourceKind[],
    iacIssuesCount: testOutput.results?.vulnerabilities?.length || 0,
    iacIgnoredIssuesCount: testOutput.results?.scanAnalytics.ignoredCount || 0,
    iacFilesCount: Object.values(iacType).reduce(
      (acc, packageManagerAnalytics) => acc + packageManagerAnalytics!.count,
      0,
    ),
    iacResourcesCount: testOutput.results?.resources?.length || 0,
    iacErrorCodes:
      [...new Set(testOutput.errors?.map((error) => error.code!))] || [],
    iacTestBinaryVersion: policyEngineReleaseVersion,
    // iacRulesBundleVersion = ''; // TODO: Add when we have the rules bundle version
  };
}
