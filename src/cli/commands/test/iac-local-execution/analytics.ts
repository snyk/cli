import { FormattedResult, PerformanceAnalyticsKey } from './types';
import * as analytics from '../../../../lib/analytics';
import { calculatePercentage } from './math-utils';
import { computeCustomRulesBundleChecksum } from './file-utils';

export function addIacAnalytics(
  formattedResults: FormattedResult[],
  opts: {
    ignoredIssuesCount: number;
    isLocalCustomRules: boolean;
    isRemoteCustomRules: boolean;
  },
): void {
  let totalIssuesCount = 0;
  const customRulesIdsFoundInIssues: { [customRuleId: string]: true } = {};
  let issuesFromCustomRulesCount = 0;
  const projectTypeAnalytics: Record<string, object> = {};
  const packageManagers = Array<string>();

  formattedResults.forEach((res) => {
    totalIssuesCount =
      (totalIssuesCount || 0) + res.result.cloudConfigResults.length;

    const projectType = res.packageManager;
    packageManagers.push(projectType);
    projectTypeAnalytics[projectType] = projectTypeAnalytics[projectType] ?? {
      count: 0,
    };
    projectTypeAnalytics[projectType]['count']++;

    res.result.cloudConfigResults.forEach((policy) => {
      projectTypeAnalytics[projectType][policy.severity] =
        (projectTypeAnalytics[projectType][policy.severity] || 0) + 1;

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
  analytics.add('iac-ignored-issues-count', opts.ignoredIssuesCount);
  analytics.add('iac-type', projectTypeAnalytics);
  analytics.add('iac-metrics', performanceAnalyticsObject);
  analytics.add('iac-test-count', formattedResults.length); // TODO: remove this once we all analytics use iac-files-count
  analytics.add('iac-files-count', formattedResults.length);
  analytics.add('iac-local-custom-rules', opts.isLocalCustomRules);
  analytics.add('iac-remote-custom-rules', opts.isRemoteCustomRules);
  analytics.add('iac-custom-rules-issues-count', issuesFromCustomRulesCount);
  analytics.add(
    'iac-custom-rules-issues-percentage',
    calculatePercentage(issuesFromCustomRulesCount, totalIssuesCount),
  );
  analytics.add(
    'iac-custom-rules-checksum',
    computeCustomRulesBundleChecksum(),
  );
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
