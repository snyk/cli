import * as fs from 'fs';
import * as pathLib from 'path';
import chalk from 'chalk';

import { formatIacTestSummary } from '../../../../../../src/lib/formatters/iac-output';
import { colors } from '../../../../../../src/lib/formatters/iac-output/v2/color-utils';
import { IacTestResponse } from '../../../../../../src/lib/snyk-test/iac-test-result';

describe('formatIacTestSummary', () => {
  let resultFixtures: IacTestResponse[];

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

  it("should include the 'Test Summary' title", () => {
    // Arrange
    const orgName = 'test-org-name';
    const projectName = 'test-project-name';
    const ignoreCount = 3;

    // Act
    const result = formatIacTestSummary(
      { ignoreCount, results: resultFixtures as any },
      { orgName, projectName },
    );

    // Assert
    expect(result).toContain(
      `${chalk.bold.white('Test Summary')}

  Organization: ${orgName}

${chalk.bold.green('✔')} Files without issues: ${chalk.bold.white('0')}
${chalk.bold.red('✗')} Files with issues: ${chalk.bold.white('3')}
  Ignored issues: ${chalk.bold.white(`${ignoreCount}`)}
  Total issues: ${chalk.bold.white('22')} [ ${colors.severities.critical(
        '0 critical',
      )}, ${colors.severities.high('5 high')}, ${colors.severities.medium(
        '4 medium',
      )}, ${colors.severities.low('13 low')} ]`,
    );
  });
  it('should include the test meta properties section with the correct values', () => {
    // Arrange
    const orgName = 'test-org-name';
    const projectName = 'test-project-name';
    const ignoreCount = 3;

    // Act
    const result = formatIacTestSummary(
      { ignoreCount, results: resultFixtures as any },
      { orgName, projectName },
    );

    // Assert
    expect(result).toContain(`${chalk.bold.white('Test Summary')}`);
  });

  it('should include the counts section with the correct values', () => {
    // Arrange
    const orgName = 'test-org-name';
    const projectName = 'test-project-name';
    const ignoreCount = 3;

    // Act
    const result = formatIacTestSummary(
      { ignoreCount, results: resultFixtures as any },
      { orgName, projectName },
    );

    // Assert
    expect(result).toContain(
      `${chalk.bold.green('✔')} Files without issues: ${chalk.bold.white('0')}
${chalk.bold.red('✗')} Files with issues: ${chalk.bold.white('3')}
  Ignored issues: ${chalk.bold.white(`${ignoreCount}`)}
  Total issues: ${chalk.bold.white('22')} [ ${colors.severities.critical(
        '0 critical',
      )}, ${colors.severities.high('5 high')}, ${colors.severities.medium(
        '4 medium',
      )}, ${colors.severities.low('13 low')} ]`,
    );
  });
});
