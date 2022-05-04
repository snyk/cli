import { IacTestResponse } from '../../../snyk-test/iac-test-result';

export interface IacTestData {
  ignoreCount: number;
  results: IacTestResponse[];
}
