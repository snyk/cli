import { isFeatureFlagSupportedForOrg } from '../../../../lib/feature-flags';
import { shareResults } from '../../../../lib/iac/cli-share-results';
import { FeatureFlagError } from './assert-iac-options-flag';
import { formatShareResults } from './share-results-formatter';

export async function formatAndShareResults(
  results,
  options,
  orgPublicId,
): Promise<Record<string, string>> {
  const isCliReportEnabled = await isFeatureFlagSupportedForOrg(
    'iacCliShareResults',
    orgPublicId,
  );
  if (!isCliReportEnabled.ok) {
    throw new FeatureFlagError('report', 'iacCliShareResults');
  }

  const formattedResults = formatShareResults(results, options);

  return await shareResults(formattedResults);
}
