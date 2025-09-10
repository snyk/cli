import { EOL } from 'os';
import { formatShareResultsOutput } from '../../../../../../../src/lib/formatters/iac-output/text';
import {
  colors,
  contentPadding,
} from '../../../../../../../src/lib/formatters/iac-output/text/utils';
import { getAppUrl } from '../../../../../../../src/lib/config/api-url';
import config from '../../../../../../../src/lib/config';

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
        colors.title(`${getAppUrl(config.API)}/org/${testOrgName}/projects`) +
        EOL +
        contentPadding +
        'under the name: ' +
        colors.title(testProjectName),
    );
  });
});
