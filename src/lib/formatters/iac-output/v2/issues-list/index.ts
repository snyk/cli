import { EOL } from 'os';
import * as capitalize from 'lodash.capitalize';
import * as isEmpty from 'lodash.isempty';
import * as debug from 'debug';

import { colors, contentPadding } from '../utils';
import { formatIssue } from './issue';
import { SEVERITY } from '../../../../snyk-test/common';
import {
  FormattedOutputResult,
  FormattedOutputResultsBySeverity,
} from '../types';
import { Options } from './types';

export function getIacDisplayedIssues(
  resultsBySeverity: FormattedOutputResultsBySeverity,
  options?: Options,
): string {
  const titleOutput = colors.title('Issues');

  if (isEmpty(resultsBySeverity)) {
    return (
      titleOutput +
      EOL +
      contentPadding +
      colors.success.bold('No vulnerable paths were found!')
    );
  }

  const severitySectionsOutput = Object.values(SEVERITY)
    .filter((severity) => !!resultsBySeverity[severity])
    .map((severity) => {
      const severityResults: FormattedOutputResult[] =
        resultsBySeverity[severity];

      const titleOutput = colors.title(
        `${capitalize(severity)} Severity Issues: ${severityResults.length}`,
      );

      const issuesOutput = severityResults
        .sort(
          (severityResult1, severityResult2) =>
            severityResult1.targetFile.localeCompare(
              severityResult2.targetFile,
            ) ||
            severityResult1.issue.id.localeCompare(severityResult2.issue.id),
        )
        .map((result) => formatIssue(result, options))
        .join(EOL.repeat(2));

      debug(
        `iac display output - ${severity} severity ${severityResults.length} issues`,
      );

      return titleOutput + EOL.repeat(2) + issuesOutput;
    })
    .join(EOL.repeat(2));

  return titleOutput + EOL.repeat(2) + severitySectionsOutput;
}
