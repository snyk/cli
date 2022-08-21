import { EOL } from 'os';
import config from '../../../../../../../src/lib/config';
import { formatShareResultsOutput } from '../../../../../../../src/lib/formatters/iac-output';
import {
  colors,
  contentPadding,
} from '../../../../../../../src/lib/formatters/iac-output/v2/utils';

describe('formatShareResultsOutput', () => {
  it('returns the correct output', () => {
    // Arrange
    const testProjectName = 'test-project';
    const testOrgName = 'test-org';

    // Act
    const output = formatShareResultsOutput(testOrgName, testProjectName);

    // Assert
    expect(output).toEqual(
      colors.title('Report Complete') +
        EOL +
        EOL +
        contentPadding +
        'Your test results are available at: ' +
        colors.title(`${config.ROOT}/org/${testOrgName}/projects`) +
        EOL +
        contentPadding +
        'under the name: ' +
        colors.title(testProjectName),
    );
  });
});
