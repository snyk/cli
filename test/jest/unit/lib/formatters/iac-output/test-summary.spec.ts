import * as fs from 'fs';
import * as pathLib from 'path';
import chalk from 'chalk';

import { formatIacTestSummary } from '../../../../../../src/lib/formatters/iac-output';
import { severityColor } from '../../../../../../src/lib/formatters/iac-output/v2/color-utils';
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
          'iac/fixtures/formatted-results.json',
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
  Total issues: ${chalk.bold.white('22')} [ ${severityColor.critical(
        '0 critical',
      )}, ${severityColor.high('5 high')}, ${severityColor.medium(
        '4 medium',
      )}, ${severityColor.low('13 low')} ]`,
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
  Total issues: ${chalk.bold.white('22')} [ ${severityColor.critical(
        '0 critical',
      )}, ${severityColor.high('5 high')}, ${severityColor.medium(
        '4 medium',
      )}, ${severityColor.low('13 low')} ]`,
    );
  });
});
