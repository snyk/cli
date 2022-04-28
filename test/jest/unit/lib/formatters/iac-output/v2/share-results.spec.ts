import config from '../../../../../../../src/lib/config';
import { formatShareResultsOutput } from '../../../../../../../src/lib/formatters/iac-output';
import { colors } from '../../../../../../../src/lib/formatters/iac-output/v2/color-utils';

describe('formatShareResultsOutput', () => {
  it('returns the correct output', () => {
    // Arrange
    const testProjectName = 'test-project';
    const testOrgName = 'test-org';

    // Act
    const output = formatShareResultsOutput({
      projectName: testProjectName,
      orgName: testOrgName,
    });

    // Assert
    expect(output).toEqual(
      colors.info.bold(
        `Your test results are available at: ${config.ROOT}/org/${testOrgName}/projects under the name ${testProjectName}`,
      ),
    );
  });

  describe('when the gitRemoteUrl is specified', () => {
    it('returns the correct output', () => {
      // Arrange
      const testProjectName = 'test-project';
      const testOrgName = 'test-org';
      const testRepoName = 'test/repo';
      const testGitRemoteUrl = `http://github.com/${testRepoName}.git`;

      // Act
      const output = formatShareResultsOutput({
        projectName: testProjectName,
        orgName: testOrgName,
        gitRemoteUrl: testGitRemoteUrl,
      });

      // Assert
      expect(output).toEqual(
        colors.info.bold(
          `Your test results are available at: ${config.ROOT}/org/${testOrgName}/projects under the name ${testRepoName}`,
        ),
      );
    });
  });
});
