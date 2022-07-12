import { filterIgnoredIssues } from './policy';
import { formatAndShareResults } from './share-results';
import { formatScanResultsV2 } from '../measurable-methods';
import { Policy } from '../../../../../../lib/policy/find-and-load-policy';
import {
  IacOutputMeta,
  ProjectAttributes,
  Tag,
} from '../../../../../../lib/types';
import {
  FormattedResult,
  IacFileScanResult,
  IacOrgSettings,
  IaCTestFlags,
} from '../types';

export async function processResults(
  resultsWithCustomSeverities: IacFileScanResult[],
  orgPublicId: string,
  iacOrgSettings: IacOrgSettings,
  policy: Policy | undefined,
  tags: Tag[] | undefined,
  attributes: ProjectAttributes | undefined,
  options: IaCTestFlags,
  projectRoot: string,
  meta: IacOutputMeta,
): Promise<{
  filteredIssues: FormattedResult[];
  ignoreCount: number;
}> {
  let projectPublicIds: Record<string, string> = {};
  let gitRemoteUrl: string | undefined;

  if (options.report) {
    ({ projectPublicIds, gitRemoteUrl } = await formatAndShareResults({
      results: resultsWithCustomSeverities,
      options,
      orgPublicId,
      policy,
      tags,
      attributes,
      projectRoot,
      meta,
    }));
  }

  const formattedResults = formatScanResultsV2(
    resultsWithCustomSeverities,
    options,
    iacOrgSettings.meta,
    projectPublicIds,
    projectRoot,
    gitRemoteUrl,
  );

  return filterIgnoredIssues(policy, formattedResults);
}
