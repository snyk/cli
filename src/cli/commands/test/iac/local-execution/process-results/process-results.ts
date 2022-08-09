import { filterIgnoredIssues } from './policy';
import { formatAndShareResults } from './share-results';
import { formatScanResults } from '../measurable-methods';
import * as cloneDeep from 'lodash.clonedeep';
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
      // this is to fix a bug where we mutated the "results" in the formatAndShareResults
      // and these were used again in the formatScanResults below
      // resulting in double count of issues
      // note: this happened only in multi-YAML documents
      results: cloneDeep(resultsWithCustomSeverities),
      options,
      orgPublicId,
      policy,
      tags,
      attributes,
      projectRoot,
      meta,
    }));
  }

  const formattedResults = formatScanResults(
    resultsWithCustomSeverities,
    options,
    iacOrgSettings.meta,
    projectPublicIds,
    projectRoot,
    gitRemoteUrl,
  );

  return filterIgnoredIssues(policy, formattedResults);
}
