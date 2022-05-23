import { Policy } from '../../../../../../lib/policy/find-and-load-policy';
import { ProjectAttributes, Tag } from '../../../../../../lib/types';
import {
  FormattedResult,
  IacFileScanResult,
  IacOrgSettings,
  IaCTestFlags,
} from '../types';
import { processResults as processResultsV2 } from './v2';
import { processResults as processResultsV1 } from './v1';

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
    return processResultsV2(
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

export class MultipleGroupsResultsProcessor implements ResultsProcessor {
  constructor(
    private pathToScan: string,
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
    return processResultsV1(
      resultsWithCustomSeverities,
      this.orgPublicId,
      this.iacOrgSettings,
      policy,
      tags,
      attributes,
      this.options,
      this.pathToScan,
    );
  }
}
