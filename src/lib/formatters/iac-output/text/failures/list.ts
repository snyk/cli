import { EOL } from 'os';

import { IacFileInDirectory } from '../../../../types';
import { colors, contentPadding } from '../utils';
import { IaCTestFailure, IaCTestWarning } from '../types';

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

export function formatFailuresList(testFailures: IaCTestFailure[]): string {
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

export function formatIacTestWarnings(testWarnings: IaCTestWarning[]): string {
  const sectionComponents: string[] = [];

  const titleOutput = colors.title(`Test Warnings`);
  sectionComponents.push(titleOutput);

  const testWarningsListOutput = formatWarningsList(testWarnings);
  sectionComponents.push(testWarningsListOutput);

  return sectionComponents.join(EOL.repeat(2));
}

function formatWarningsList(testWarnings: IaCTestWarning[]): string {
  const testWarningsByReasonAndPath = groupTestWarningsByReasonAndPath(
    testWarnings,
  );

  return Object.values(testWarningsByReasonAndPath)
    .map((testWarning) => {
      return formatWarning(testWarning);
    })
    .join(EOL.repeat(2));
}

type groupedIacTestWarnings = {
  reason: string;
  path: string;
  terms: string[];
  modules: string[];
  expressions: string[];
};

function groupTestWarningsByReasonAndPath(
  testWarnings: IaCTestWarning[],
): { [key: string]: groupedIacTestWarnings } {
  return testWarnings.reduce(
    (groupedWarnings: { [key: string]: groupedIacTestWarnings }, warning) => {
      const reasonAndPath = `${warning.warningReason}${warning.filePath}`;
      if (reasonAndPath) {
        if (!groupedWarnings[reasonAndPath]) {
          groupedWarnings[reasonAndPath] = {
            reason: warning.warningReason!,
            path: warning.filePath,
            terms: [],
            modules: [],
            expressions: [],
          };
        }

        if (warning.term) {
          groupedWarnings[reasonAndPath].terms.push(warning.term);
        }
        if (warning.module) {
          groupedWarnings[reasonAndPath].modules.push(warning.module);
        }
        if (warning.modules) {
          groupedWarnings[reasonAndPath].modules.push(...warning.modules);
        }
        if (warning.expressions) {
          groupedWarnings[reasonAndPath].expressions.push(
            ...warning.expressions,
          );
        }
      }

      return groupedWarnings;
    },
    {},
  );
}

function formatWarning(testWarnings: groupedIacTestWarnings): string {
  const pathPrefix = contentPadding + 'Path: ';

  const fieldsPrefixes: { [field: string]: string } = {};
  if (testWarnings.terms.length) {
    fieldsPrefixes['terms'] = contentPadding + 'Term: ';
  }
  if (testWarnings.modules.length) {
    fieldsPrefixes['modules'] = contentPadding + 'Module: ';
  }
  if (testWarnings.expressions.length) {
    fieldsPrefixes['expressions'] = contentPadding + 'Expression: ';
  }

  const prefixes = [pathPrefix, ...Object.values(fieldsPrefixes)];
  const leftPadding = ' '.repeat(Math.max(...prefixes.map((el) => el.length)));

  return (
    contentPadding +
    colors.warning.bold(testWarnings.reason) +
    EOL +
    pathPrefix +
    testWarnings.path +
    Object.entries(fieldsPrefixes).map(([field, prefix]) => {
      return (
        EOL +
        prefix +
        testWarnings[field].map((value) => value).join(EOL + leftPadding)
      );
    })
  );
}
