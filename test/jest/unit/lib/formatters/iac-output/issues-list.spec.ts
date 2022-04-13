import * as fs from 'fs';
import * as pathLib from 'path';
import chalk from 'chalk';

import { getIacDisplayedIssues } from '../../../../../../src/lib/formatters/iac-output';
import { severityColor } from '../../../../../../src/lib/formatters/iac-output/v2/color-utils';
import { IacOutputMeta } from '../../../../../../src/lib/types';
import { FormattedResult } from '../../../../../../src/cli/commands/test/iac/local-execution/types';

describe('getIacDisplayedIssues', () => {
  let resultFixtures: FormattedResult[];
  const outputMeta: IacOutputMeta = {
    orgName: 'Shmulik.Kipod',
    projectName: 'project-name',
  };

  beforeAll(async () => {
    resultFixtures = JSON.parse(
      fs.readFileSync(
        pathLib.join(
          __dirname,
          '..',
          '..',
          '..',
          'iac',
          'process-results',
          'fixtures',
          'formatted-results.json',
        ),
        'utf8',
      ),
    );
  });

  it("should include the 'Issues' title", () => {
    const result = getIacDisplayedIssues(resultFixtures, outputMeta);

    expect(result).toContain(chalk.bold.white('Issues'));
  });

  it('should include a subtitle for each severity with the correct amount of issues', () => {
    const result = getIacDisplayedIssues(resultFixtures, outputMeta);

    expect(result).toContain(
      severityColor.low(chalk.bold(`Low Severity Issues: 13`)),
    );
    expect(result).toContain(
      severityColor.medium(chalk.bold(`Medium Severity Issues: 4`)),
    );
    expect(result).toContain(
      severityColor.high(chalk.bold(`High Severity Issues: 5`)),
    );
  });
});
