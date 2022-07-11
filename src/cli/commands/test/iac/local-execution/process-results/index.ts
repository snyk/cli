import { Policy } from '../../../../../../lib/policy/find-and-load-policy';
import { ProjectAttributes, Tag } from '../../../../../../lib/types';
import {
  FormattedResult,
  IacFileScanResult,
  IacOrgSettings,
  IaCTestFlags,
} from '../types';
import { processResults } from './process-results';

export interface ResultsProcessor {
  processResults(
    resultsWithCustomSeverities: IacFileScanResult[],
    policy: Policy | undefined,
    tags: Tag[] | undefined,
    attributes: ProjectAttributes | undefined,
  ): Promise<{
    filteredIssues: FormattedResult[];
    ignoreCount: number;
  }>;
}

export class SingleGroupResultsProcessor implements ResultsProcessor {
  constructor(
    private projectRoot: string,
    private orgPublicId: string,
    private iacOrgSettings: IacOrgSettings,
    private options: IaCTestFlags,
  ) {}

  processResults(
    resultsWithCustomSeverities: IacFileScanResult[],
    policy: Policy | undefined,
    tags: Tag[] | undefined,
    attributes: ProjectAttributes | undefined,
  ): Promise<{ filteredIssues: FormattedResult[]; ignoreCount: number }> {
    return processResults(
      resultsWithCustomSeverities,
      this.orgPublicId,
      this.iacOrgSettings,
      policy,
      tags,
      attributes,
      this.options,
      this.projectRoot,
    );
  }
}
