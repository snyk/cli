import { FormattedResult } from './types';
import * as analytics from '../../../../lib/analytics';

export function addIacAnalytics(
  formattedResults: FormattedResult[],
  /* eslint-disable @typescript-eslint/no-unused-vars */
  ignoredIssuesCount: number,
) {
  let totalIssuesCount = 0;
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
    });
  });

  analytics.add('packageManager', Array.from(new Set(packageManagers)));
  analytics.add('iac-issues-count', totalIssuesCount);
  // TODO enable once we have support for it in registry
  // analytics.add('iac-ignored-issues-count', ignoredIssuesCount);
  analytics.add('iac-type', issuesByType);
  analytics.add('iac-metrics', performanceAnalyticsObject);
  analytics.add('iac-test-count', formattedResults.length);
}

export enum PerformanceAnalyticsKey {
  InitLocalCache = 'cache-init-ms',
  FileLoading = 'file-loading-ms',
  FileParsing = 'file-parsing-ms',
  FileScanning = 'file-scanning-ms',
  OrgSettings = 'org-settings-ms',
  CustomSeverities = 'custom-severities-ms',
  ResultFormatting = 'results-formatting-ms',
  UsageTracking = 'usage-tracking-ms',
  CacheCleanup = 'cache-cleanup-ms',
  Total = 'total-iac-ms',
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
