import { FormattedResult, PerformanceAnalyticsKey, RulesOrigin } from './types';
import * as analytics from '../../../../lib/analytics';
import { calculatePercentage } from './math-utils';
import { computeCustomRulesBundleChecksum } from './file-utils';
import {
  DescribeOptions,
  DriftctlExecutionResult,
} from '../../../../lib/iac/types';
import {
  driftctlVersion,
  parseDriftAnalysisResults,
} from '../../../../lib/iac/drift';

export function addIacAnalytics(
  formattedResults: FormattedResult[],
  opts: {
    ignoredIssuesCount: number;
    rulesOrigin: RulesOrigin;
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
  analytics.add(
    'iac-local-custom-rules',
    opts.rulesOrigin === RulesOrigin.Local,
  );
  analytics.add(
    'iac-remote-custom-rules',
    opts.rulesOrigin === RulesOrigin.Remote,
  );
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

export function addIacDriftAnalytics(
  describe: DriftctlExecutionResult,
  options: DescribeOptions,
): void {
  const driftctlAnalysis = parseDriftAnalysisResults(describe.stdout);

  let scope: string;
  if (options['only-managed']) {
    scope = 'managed';
  } else if (options['only-unmanaged']) {
    scope = 'unmanaged';
  } else {
    scope = 'all';
  }

  analytics.add('is-iac-drift', true);
  analytics.add('iac-drift-coverage', driftctlAnalysis.coverage);
  analytics.add('iac-drift-exit-code', describe.code);
  analytics.add(
    'iac-drift-total-resources',
    driftctlAnalysis.summary.total_resources,
  );
  analytics.add(
    'iac-drift-total-unmanaged',
    driftctlAnalysis.summary.total_unmanaged,
  );
  analytics.add(
    'iac-drift-total-managed',
    driftctlAnalysis.summary.total_managed,
  );
  analytics.add(
    'iac-drift-total-missing',
    driftctlAnalysis.summary.total_missing,
  );
  analytics.add(
    'iac-drift-total-changed',
    driftctlAnalysis.summary.total_changed,
  );
  analytics.add(
    'iac-drift-iac-source-count',
    driftctlAnalysis.summary.total_iac_source_count,
  );
  analytics.add('iac-drift-provider-name', driftctlAnalysis.provider_name);
  analytics.add(
    'iac-drift-provider-version',
    driftctlAnalysis.provider_version,
  );
  analytics.add('iac-drift-version', driftctlVersion);
  analytics.add('iac-drift-scan-duration', driftctlAnalysis.scan_duration);
  analytics.add('iac-drift-binary-already-exist', describe.binaryExist);
  analytics.add(
    'iac-drift-binary-download-duration-seconds',
    describe.downloadDuration,
  );
  analytics.add('iac-drift-scan-scope', scope);
}
