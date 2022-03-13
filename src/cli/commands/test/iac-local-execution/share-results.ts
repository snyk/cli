import { isFeatureFlagSupportedForOrg } from '../../../../lib/feature-flags';
import { shareResults } from '../../../../lib/iac/cli-share-results';
import { Policy } from '../../../../lib/policy/find-and-load-policy';
import { FeatureFlagError } from './assert-iac-options-flag';
import { formatShareResults } from './share-results-formatter';
import { IacFileScanResult, IaCTestFlags } from './types';

export async function formatAndShareResults(
  results: IacFileScanResult[],
  options: IaCTestFlags,
  orgPublicId: string,
  policy: Policy | undefined,
): Promise<Record<string, string>> {
  const isCliReportEnabled = await isFeatureFlagSupportedForOrg(
    'iacCliShareResults',
    orgPublicId,
  );
  if (!isCliReportEnabled.ok) {
    throw new FeatureFlagError('report', 'iacCliShareResults');
  }

  const formattedResults = formatShareResults(results, options);

  return await shareResults(formattedResults, policy, options);
}
