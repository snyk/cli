import { shareResults } from './cli-share-results';
import { Policy } from 'snyk-policy';
import {
  IacOutputMeta,
  ProjectAttributes,
  Tag,
} from '../../../../../../lib/types';
import { FeatureFlagError } from '../assert-iac-options-flag';
import { formatShareResults } from './share-results-formatter';
import { IacFileScanResult, IaCTestFlags, ShareResultsOutput } from '../types';
import { getOrganizationID } from '../../../../../../lib/organization';
import { getEnabledFeatureFlags } from '../../../../../../lib/feature-flag-gateway';

export async function formatAndShareResults({
  results,
  options,
  orgPublicId,
  policy,
  tags,
  attributes,
  projectRoot,
  meta,
}: {
  results: IacFileScanResult[];
  options: IaCTestFlags;
  orgPublicId: string;
  policy: Policy | undefined;
  tags?: Tag[];
  attributes?: ProjectAttributes;
  projectRoot: string;
  meta: IacOutputMeta;
}): Promise<ShareResultsOutput> {
  const featureFlags = await getEnabledFeatureFlags(
    ['iacCliShareResults'],
    orgPublicId?.trim() || getOrganizationID(),
  );

  if (!featureFlags.has('iacCliShareResults')) {
    throw new FeatureFlagError('report', 'iacCliShareResults');
  }

  const formattedResults = formatShareResults(projectRoot, results, meta);

  return await shareResults({
    results: formattedResults,
    policy,
    tags,
    attributes,
    options,
    meta,
  });
}
