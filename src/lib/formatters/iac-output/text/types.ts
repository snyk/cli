import { IacProjectType } from '../../../iac/constants';
import { State } from '../../../iac/test/v2/scan/policy-engine';
import { AnnotatedIacIssue } from '../../../snyk-test/iac-test-result';
import { SEVERITY } from '../../../snyk-test/legacy';
import { IacOutputMeta } from '../../../types';

export interface IacTestData {
  resultsBySeverity: FormattedOutputResultsBySeverity;
  metadata: IacOutputMeta | undefined;
  counts: IacTestCounts;
}

export type FormattedOutputResultsBySeverity = {
  [severity in SEVERITY]?: FormattedOutputResult[];
};

export type FormattedOutputResult = {
  issue: Issue;
  targetFile: string;
  projectType: IacProjectType | State.InputTypeEnum;
};

export interface IacTestCounts {
  ignores: number;
  filesWithIssues: number;
  filesWithoutIssues: number;
  issues: number;
  issuesBySeverity: { [severity in SEVERITY]: number };
}

export type IaCTestFailure = {
  filePath: string;
  failureReason: string | undefined;
};

export type Issue = Pick<
  AnnotatedIacIssue,
  | 'id'
  | 'title'
  | 'severity'
  | 'issue'
  | 'impact'
  | 'resolve'
  | 'remediation'
  | 'lineNumber'
  | 'isGeneratedByCustomRule'
  | 'documentation'
  | 'cloudConfigPath'
>;
