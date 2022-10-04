import { TestOutput } from '../scan/results';
import { TestConfig } from '../types';
import { countSuppressedIssues } from '../../../../formatters/iac-output/text/utils';
import { IacAnalytics } from './index';

type IacCloudContext = Pick<
  IacAnalytics,
  | 'iacCloudContext'
  | 'iacCloudContextCloudProvider'
  | 'iacCloudContextSuppressedIssuesCount'
>;

export function getIacCloudContext(
  testConfig: TestConfig,
  testOutput: TestOutput,
): IacCloudContext {
  let iacCloudContext;
  if (testConfig.cloudContext) {
    iacCloudContext = 'cloud-context';
  } else if (testConfig.snykCloudEnvironment) {
    iacCloudContext = 'snyk-cloud-environment';
  }

  let iacCloudContextSuppressedIssuesCount = 0;
  const suppressedIssues = testOutput.results?.scanAnalytics?.suppressedResults;
  if (suppressedIssues) {
    iacCloudContextSuppressedIssuesCount = countSuppressedIssues(
      suppressedIssues,
    );
  }

  return {
    iacCloudContext,
    iacCloudContextCloudProvider: testConfig.cloudContext,
    iacCloudContextSuppressedIssuesCount,
  };
}
