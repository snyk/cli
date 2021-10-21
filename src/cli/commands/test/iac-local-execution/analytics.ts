import { FormattedResult, PerformanceAnalyticsKey } from './types';
import * as analytics from '../../../../lib/analytics';
import { calculatePercentage } from './math-utils';
import { computeCustomRulesBundleChecksum } from './file-utils';

export function addIacAnalytics(
  formattedResults: FormattedResult[],
  ignoredIssuesCount: number,
  isLocalCustomRules: boolean,
): void {
  let totalIssuesCount = 0;
  const customRulesIdsFoundInIssues: { [customRuleId: string]: true } = {};
  let issuesFromCustomRulesCount = 0;
  const issuesByType: Record<string, object> = {};
  const packageManagers = Array<string>();

  formattedResults.forEach((res) => {
    totalIssuesCount =
      (totalIssuesCount || 0) + res.result.cloudConfigResults.length;

    const packageManagerConfig = res.packageManager;
    packageManagers.push(packageManagerConfig);

    res.result.cloudConfigResults.forEach((policy) => {
      issuesByType[packageManagerConfig] =
        issuesByType[packageManagerConfig] ?? {};
      issuesByType[packageManagerConfig][policy.severity] =
        (issuesByType[packageManagerConfig][policy.severity] || 0) + 1;

      if (policy.isGeneratedByCustomRule) {
        issuesFromCustomRulesCount++;
        customRulesIdsFoundInIssues[policy.publicId] = true;
      }
    });
  });

  const uniqueCustomRulesCount: number = Object.keys(
    customRulesIdsFoundInIssues,
  ).length;

  analytics.add('packageManager', Array.from(new Set(packageManagers)));
  analytics.add('iac-issues-count', totalIssuesCount);
  analytics.add('iac-ignored-issues-count', ignoredIssuesCount);
  analytics.add('iac-type', issuesByType);
  analytics.add('iac-metrics', performanceAnalyticsObject);
  analytics.add('iac-test-count', formattedResults.length);
  analytics.add('iac-custom-rules-issues-count', issuesFromCustomRulesCount);
  analytics.add(
    'iac-custom-rules-issues-percentage',
    calculatePercentage(issuesFromCustomRulesCount, totalIssuesCount),
  );
  if (!isLocalCustomRules) {
    analytics.add(
      'iac-custom-rules-checksum',
      computeCustomRulesBundleChecksum(),
    );
  }
  analytics.add('iac-custom-rules-coverage-count', uniqueCustomRulesCount);
}

export const performanceAnalyticsObject: Record<
  PerformanceAnalyticsKey,
  number | null
> = {
  [PerformanceAnalyticsKey.InitLocalCache]: null,
  [PerformanceAnalyticsKey.FileLoading]: null,
  [PerformanceAnalyticsKey.FileParsing]: null,
  [PerformanceAnalyticsKey.FileScanning]: null,
  [PerformanceAnalyticsKey.OrgSettings]: null,
  [PerformanceAnalyticsKey.CustomSeverities]: null,
  [PerformanceAnalyticsKey.ResultFormatting]: null,
  [PerformanceAnalyticsKey.UsageTracking]: null,
  [PerformanceAnalyticsKey.CacheCleanup]: null,
  [PerformanceAnalyticsKey.Total]: null,
};
