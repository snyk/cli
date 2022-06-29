import { State } from '../../../../../cli/commands/test/iac/v2/policy-engine-types';
import { IacProjectType } from '../../../../iac/constants';
import { SEVERITY } from '../../../../snyk-test/common';
import { AnnotatedIacIssue } from '../../../../snyk-test/iac-test-result';
import { IacOutputMeta } from '../../../../types';

export type FormattedOutputResult = {
  issue: AnnotatedIacIssue;
  targetFile: string;
  projectType: IacProjectType | State.InputTypeEnum;
};

export type FormattedOutputResultsBySeverity = {
  [severity in keyof SEVERITY]?: FormattedOutputResult[];
};

export type IacTestOutput = {
  results: FormattedOutputResultsBySeverity;
  metadata: IacOutputMeta;
};
