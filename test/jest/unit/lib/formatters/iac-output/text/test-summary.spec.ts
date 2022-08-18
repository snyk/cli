import * as clonedeep from 'lodash.clonedeep';
import * as fs from 'fs';
import * as pathLib from 'path';

import { formatIacTestSummary } from '../../../../../../../src/lib/formatters/iac-output/text';
import { colors } from '../../../../../../../src/lib/formatters/iac-output/text/utils';
import { IacTestData } from '../../../../../../../src/lib/formatters/iac-output/text/types';

describe('formatIacTestSummary', () => {
  let testDataFixture: IacTestData;

  beforeAll(async () => {
    testDataFixture = JSON.parse(
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
          'test-data.json',
        ),
        'utf8',
      ),
    );
  });

  it("should include the 'Test Summary' title", () => {
    // Arrange
    const testTestData: IacTestData = clonedeep(testDataFixture);

    // Act
    const result = formatIacTestSummary(testTestData);

    // Assert
    expect(result).toContain(`${colors.title('Test Summary')}`);
  });

  it('should include the test meta properties section with the correct values', () => {
    // Arrange
    const testTestData: IacTestData = clonedeep(testDataFixture);

    // Act
    const result = formatIacTestSummary(testTestData);

    // Assert
    expect(result).toContain(`Organization: Shmulik.Kipod
  Project name: project-name`);
  });

  it('should include the counts section with the correct values', () => {
    // Arrange
    const testTestData: IacTestData = clonedeep(testDataFixture);

    // Act
    const result = formatIacTestSummary(testTestData);

    // Assert
    expect(result).toContain(
      `${colors.success.bold('✔')} Files without issues: ${colors.info.bold(
        '0',
      )}
${colors.failure.bold('✗')} Files with issues: ${colors.info.bold('3')}
  Ignored issues: ${colors.info.bold('3')}
  Total issues: ${colors.info.bold('22')} [ ${colors.severities.critical(
        '0 critical',
      )}, ${colors.severities.high('5 high')}, ${colors.severities.medium(
        '4 medium',
      )}, ${colors.severities.low('13 low')} ]`,
    );
  });
});
