import * as fs from 'fs';
import * as pathLib from 'path';

import { getIacDisplayedIssues } from '../../../../../../../src/lib/formatters/iac-output';
import { colors } from '../../../../../../../src/lib/formatters/iac-output/v2/color-utils';
import { IacOutputMeta } from '../../../../../../../src/lib/types';
import { FormattedResult } from '../../../../../../../src/cli/commands/test/iac/local-execution/types';

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

    expect(result).toContain(colors.info.bold('Issues'));
  });

  it('should include a subtitle for each severity with the correct amount of issues', () => {
    const result = getIacDisplayedIssues(resultFixtures, outputMeta);

    expect(result).toContain(colors.severities.low(`Low Severity Issues: 13`));
    expect(result).toContain(
      colors.severities.medium(`Medium Severity Issues: 4`),
    );
    expect(result).toContain(colors.severities.high(`High Severity Issues: 5`));
  });

  describe('with no issues', () => {
    let resultsWithNoIssues: FormattedResult[];

    beforeAll(() => {
      resultsWithNoIssues = resultFixtures.map((resultFixture) => ({
        ...resultFixture,
        result: {
          ...resultFixture.result,
          cloudConfigResults: [],
        },
      }));
    });

    it('should display an appropriate message', () => {
      // Act
      const result = getIacDisplayedIssues(resultsWithNoIssues, outputMeta);

      // Assert
      expect(result).toContain(
        colors.success.bold('No vulnerable paths were found!'),
      );
    });

    it('should not display any severity sections', () => {
      // Act
      const result = getIacDisplayedIssues(resultsWithNoIssues, outputMeta);

      // Assert
      expect(result).not.toContain(
        colors.severities.low('Low Severity Issues'),
      );
      expect(result).not.toContain(
        colors.severities.medium('Medium Severity Issues'),
      );
      expect(result).not.toContain(
        colors.severities.high('High Severity Issues'),
      );
      expect(result).not.toContain(
        colors.severities.critical('Critical Severity Issues'),
      );
    });
  });
});
