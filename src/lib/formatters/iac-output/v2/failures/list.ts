import { EOL } from 'os';

import { IacFileInDirectory } from '../../../../types';
import { colors, contentPadding } from '../utils';
import { IaCTestFailure } from '../types';

export function formatIacTestFailures(testFailures: IaCTestFailure[]): string {
  const sectionComponents: string[] = [];

  const titleOutput = colors.title(`Test Failures`);
  sectionComponents.push(titleOutput);

  const testFailuresListOutput = formatFailuresList(testFailures);
  sectionComponents.push(testFailuresListOutput);

  return sectionComponents.join(EOL.repeat(2));
}

interface TestFailuresByFailureReason {
  [reason: string]: IacFileInDirectory[];
}

function groupTestFailuresByFailureReason(
  testFailures: IaCTestFailure[],
): TestFailuresByFailureReason {
  return testFailures.reduce((groupedFailures, failure) => {
    const reason = failure.failureReason;
    if (reason) {
      if (!groupedFailures[reason]) {
        groupedFailures[reason] = [];
      }

      groupedFailures[reason].push(failure);
    }

    return groupedFailures;
  }, {});
}

function formatFailuresList(testFailures: IaCTestFailure[]) {
  const testFailuresByReason = groupTestFailuresByFailureReason(testFailures);
  return Object.entries(testFailuresByReason)
    .map(([failureReason, testFailures]) =>
      formatFailure(failureReason, testFailures),
    )
    .join(EOL.repeat(2));
}

function formatFailure(
  failureReason: string,
  testFailures: IacFileInDirectory[],
): string {
  const pathPrefix = contentPadding + 'Path: ';
  const pathLeftPadding = ' '.repeat(pathPrefix.length);

  return (
    contentPadding +
    colors.failure.bold(failureReason) +
    EOL +
    pathPrefix +
    testFailures
      .map((testFailure) => testFailure.filePath)
      .join(EOL + pathLeftPadding)
  );
}
