import * as fs from 'fs';
import * as pathLib from 'path';

import { formatIacTestSummary } from '../../../../../../../src/lib/formatters/iac-output';
import { colors } from '../../../../../../../src/lib/formatters/iac-output/v2/utils';
import { IacTestResponse } from '../../../../../../../src/lib/snyk-test/iac-test-result';
import { IacFileInDirectory } from '../../../../../../../src/lib/types';

describe('formatIacTestSummary', () => {
  let resultFixtures: IacTestResponse[];
  let scanFailureFixtures: IacFileInDirectory[];

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

    scanFailureFixtures = JSON.parse(
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
          'scan-failures.json',
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
      { ignoreCount, results: resultFixtures },
      { orgName, projectName },
    );

    // Assert
    expect(result).toContain(`${colors.title('Test Summary')}`);
  });

  it('should include the test meta properties section with the correct values', () => {
    // Arrange
    const orgName = 'test-org-name';
    const projectName = 'test-project-name';
    const ignoreCount = 3;

    // Act
    const result = formatIacTestSummary(
      { ignoreCount, results: resultFixtures },
      { orgName, projectName },
    );

    // Assert
    expect(result).toContain(`Organization: ${orgName}`);
  });

  it('should include the counts section with the correct values', () => {
    // Arrange
    const orgName = 'test-org-name';
    const projectName = 'test-project-name';
    const ignoreCount = 3;

    // Act
    const result = formatIacTestSummary(
      { ignoreCount, results: resultFixtures, failures: scanFailureFixtures },
      { orgName, projectName },
    );

    // Assert
    expect(result).toContain(
      `${colors.success.bold('✔')} Files without issues: ${colors.info.bold(
        '0',
      )}
${colors.failure.bold('✗')} Files with issues: ${colors.info.bold('3')}
  Invalid files: ${colors.info.bold(`${scanFailureFixtures.length}`)}
  Ignored issues: ${colors.info.bold(`${ignoreCount}`)}
  Total issues: ${colors.info.bold('22')} [ ${colors.severities.critical(
        '0 critical',
      )}, ${colors.severities.high('5 high')}, ${colors.severities.medium(
        '4 medium',
      )}, ${colors.severities.low('13 low')} ]`,
    );
  });

  describe('when a failures list is not provided', () => {
    it('should indicate 0 invalid files', () => {
      // Arrange
      const orgName = 'test-org-name';
      const projectName = 'test-project-name';
      const ignoreCount = 3;

      // Act
      const result = formatIacTestSummary(
        { ignoreCount, results: resultFixtures },
        { orgName, projectName },
      );

      // Assert
      expect(result).toContain(`Invalid files: ${colors.info.bold('0')}`);
    });
  });
});
