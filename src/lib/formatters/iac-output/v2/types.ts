import { IacTestResponse } from '../../../snyk-test/iac-test-result';
import { PolicyMetadata } from '../../../../cli/commands/test/iac/local-execution/types';
import { SEVERITY } from '../../../snyk-test/common';
import { IacOutputMeta } from '../../../types';

export interface IacTestData {
  ignoreCount: number;
  results: IacTestResponse[];
}

export type FormattedIssue = {
  policyMetadata: PolicyMetadata;
  // Decide which one of them to keep
  targetFile: string;
  targetFilePath: string;
};

type FormattedResultsBySeverity = {
  [severity in keyof SEVERITY]?: FormattedIssue[];
};

export type IacTestOutput = {
  results: FormattedResultsBySeverity;
  metadata: IacOutputMeta;
};
