import { FormattedResult } from './types';
import * as analytics from '../../../../lib/analytics';

export function addIacAnalytics(formattedResults: FormattedResult[]) {
  let totalIssuesCount = 0;
  const issuesByType: Record<string, object> = {};
  const packageManagers = Array<string>();

  formattedResults.forEach((res) => {
    totalIssuesCount =
      (totalIssuesCount || 0) + res.result.cloudConfigResults.length;
    packageManagers.push(res.packageManager);

    res.result.cloudConfigResults.forEach((policy) => {
      const configType = policy.type + 'config';
      issuesByType[configType] = issuesByType[configType] ?? {};
      issuesByType[configType][policy.severity] =
        (issuesByType[configType][policy.severity] || 0) + 1;
    });
  });

  analytics.add('packageManager', Array.from(new Set(packageManagers)));
  analytics.add('iac-issues-count', totalIssuesCount);
  analytics.add('iac-type', issuesByType);
  analytics.add('iac-test-count', formattedResults.length);
}
