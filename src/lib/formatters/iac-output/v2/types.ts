import { IacTestResponse } from '../../../snyk-test/iac-test-result';

export type IaCTestFailureType = 'file' | 'path';

export interface IacTestData {
  ignoreCount: number;
  results: IacTestResponse[];
  failures?: IaCTestFailure[];
}

export type IaCTestFailure = {
  failureType: IaCTestFailureType;
  filePath: string;
  failureReason: string | undefined;
};
