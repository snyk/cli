import chalk from 'chalk';
import { EOL } from 'os';
import capitalize = require('lodash/capitalize');
import debug = require('debug');

import { FormattedResult } from '../../../../cli/commands/test/iac/local-execution/types';
import { IacOutputMeta } from '../../../types';
import { colors } from './color-utils';
import { formatScanResultsNewOutput } from './formatters';
import { FormattedIssue } from './types';

export function getIacDisplayedIssues(
  results: FormattedResult[],
  outputMeta: IacOutputMeta,
): string {
  const formattedResults = formatScanResultsNewOutput(results, outputMeta);

  let output = EOL + chalk.bold.white('Issues') + EOL;

  ['low', 'medium', 'high', 'critical'].forEach((severity) => {
    if (formattedResults.results[severity]) {
      const issues = formattedResults.results[severity];
      output +=
        EOL +
        colors.severities[severity](
          `${capitalize(severity)} Severity Issues: ${issues.length}`,
        ) +
        EOL.repeat(2);
      output += getIssuesOutput(issues);

      debug(
        `iac display output - ${severity} severity ${issues.length} issues`,
      );
    }
  });

  return output;
}

// CFG-1574 will continue the work on this function
function getIssuesOutput(issues: FormattedIssue[]) {
  let output = '';

  issues.forEach((issue) => {
    output += chalk.white(`${issue.policyMetadata.title}`) + EOL;
  });

  return output;
}
