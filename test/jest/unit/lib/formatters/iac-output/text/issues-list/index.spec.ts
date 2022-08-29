import * as fs from 'fs';
import * as pathLib from 'path';
import chalk from 'chalk';
import { getIacDisplayedIssues } from '../../../../../../../../src/lib/formatters/iac-output/text';
import { colors } from '../../../../../../../../src/lib/formatters/iac-output/text/utils';
import { FormattedOutputResultsBySeverity } from '../../../../../../../../src/lib/formatters/iac-output/text/types';
import { SEVERITY } from '../../../../../../../../src/lib/snyk-test/legacy';

describe('getIacDisplayedIssues', () => {
  let resultFixtures: FormattedOutputResultsBySeverity;

  beforeAll(async () => {
    resultFixtures = JSON.parse(
      fs.readFileSync(
        pathLib.join(
          __dirname,
          '..',
          '..',
          '..',
          '..',
          '..',
          'iac',
          'process-results',
          'fixtures',
          'new-output-formatted-results.json',
        ),
        'utf8',
      ),
    );
  });

  it("should include the 'Issues' title", () => {
    const result = getIacDisplayedIssues(resultFixtures);

    expect(result).toContain(colors.title('Issues'));
  });

  it('should include a subtitle for each severity with the correct amount of issues', () => {
    const result = getIacDisplayedIssues(resultFixtures);

    expect(result).toContain(colors.title(`Low Severity Issues: 13`));
    expect(result).toContain(colors.title(`Medium Severity Issues: 4`));
    expect(result).toContain(colors.title(`High Severity Issues: 5`));
  });

  it('should include the correct issues in each severity section, and display the correct issue details', () => {
    // Act
    const result = getIacDisplayedIssues(resultFixtures);

    // Assert
    expect(result).toContain(
      `  ${colors.severities.low(
        `[Low] ${chalk.bold('EC2 API termination protection is not enabled')}`,
      )}
  Info:    To prevent instance from being accidentally terminated using Amazon
           EC2, you can enable termination protection for the instance. Without
           this setting enabled the instances can be terminated by accident.
           This setting should only be used for instances with high availability
           requirements. Enabling this may prevent IaC workflows from updating
           the instance, for example terraform will not be able to terminate the
           instance to update instance type
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-AWS-426')}
  Path:    resource > aws_instance[denied] > disable_api_termination
  File:    aws_ec2_metadata_secrets.tf
  Resolve: Set \`disable_api_termination\` attribute  with value \`true\``,
    );

    expect(result).toContain(
      `  ${colors.severities.medium(
        `[Medium] ${chalk.bold('Non-Encrypted root block device')}`,
      )}
  Info:    The root block device for ec2 instance is not encrypted. That should
           someone gain unauthorized access to the data they would be able to
           read the contents.
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-TF-53')}
  Path:    [DocId: 0] > Resources > BastionHost > Properties >
           BlockDeviceMappings
  File:    bastion.yml
  Resolve: Set \`BlockDeviceMappings.Encrypted\` attribute of root device to
           \`true\``,
    );

    expect(result).toContain(
      `  ${colors.severities.high(
        `[High] ${chalk.bold('Container is running in privileged mode')}`,
      )}
  Info:    Container is running in privileged mode. Compromised container could
           potentially modify the underlying host’s kernel by loading
           unauthorized modules (i.e. drivers).
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-1')}
  Path:    [DocId: 0] > input > spec > template > spec > containers[web] >
           securityContext > privileged
  File:    k8s.yaml
  Resolve: Remove \`securityContext.privileged\` attribute, or set value to
           \`false\``,
    );
  });

  it('should break issue details lines', async () => {
    // Arrange
    const lowIssue = resultFixtures[SEVERITY.LOW]![0];
    const testResults: FormattedOutputResultsBySeverity = {
      low: [
        {
          ...lowIssue,
          issue: {
            ...lowIssue.issue,
            issue:
              'Lorem ipsum dolor sit amet consectetur adipisicing elit. Cumque doloribus molestiae atque eveniet, minus, obcaecati possimus libero id porro alias nihil sit vero necessitatibus quos labore provident.',
            impact:
              'Lorem ipsum dolor sit amet consectetur adipisicing elit. Cumque doloribus molestiae atque eveniet, minus, obcaecati possimus libero id porro alias nihil sit vero necessitatibus quos labore provident.',
          },
        },
      ],
    };

    // Act
    const result = getIacDisplayedIssues(testResults);

    // Assert
    expect(result)
      .toContain(`Info:    Lorem ipsum dolor sit amet consectetur adipisicing elit. Cumque
           doloribus molestiae atque eveniet, minus, obcaecati possimus libero
           id porro alias nihil sit vero necessitatibus quos labore provident.
           Lorem ipsum dolor sit amet consectetur adipisicing elit. Cumque
           doloribus molestiae atque eveniet, minus, obcaecati possimus libero
           id porro alias nihil sit vero necessitatibus quos labore provident.`);
  });

  describe('with no issues', () => {
    it('should display an appropriate message', () => {
      // Arrange
      const resultsWithNoIssues: FormattedOutputResultsBySeverity = {};

      // Act
      const result = getIacDisplayedIssues(resultsWithNoIssues);

      // Assert
      expect(result).toContain(
        colors.success.bold('No vulnerable paths were found!'),
      );
    });

    it('should not display any severity sections', () => {
      // Arrange
      const resultsWithNoIssues: FormattedOutputResultsBySeverity = {};

      // Act
      const result = getIacDisplayedIssues(resultsWithNoIssues);

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

  describe('with the `shouldShowLineNumbers` option', () => {
    it('should display line numbers', () => {
      // Act
      const result = getIacDisplayedIssues(resultFixtures, {
        shouldShowLineNumbers: true,
      });

      // Assert
      expect(result).toContain('aws_ec2_metadata_secrets.tf:21');
    });

    describe('when an issue does not have a line number', () => {
      it('should not display the line number', () => {
        // Act
        const result = getIacDisplayedIssues(resultFixtures, {
          shouldShowLineNumbers: true,
        });

        // Assert
        expect(result).toContain(
          `  ${colors.severities.low(
            `[Low] ${chalk.bold(
              'EC2 API termination protection is not enabled',
            )}`,
          )}
  Info:    To prevent instance from being accidentally terminated using Amazon
           EC2, you can enable termination protection for the instance. Without
           this setting enabled the instances can be terminated by accident.
           This setting should only be used for instances with high availability
           requirements. Enabling this may prevent IaC workflows from updating
           the instance, for example terraform will not be able to terminate the
           instance to update instance type
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-AWS-426')}
  Path:    resource > aws_instance[denied_3] > disable_api_termination
  File:    aws_ec2_metadata_secrets.tf
  Resolve: Set \`disable_api_termination\` attribute  with value \`true\``,
        );
      });
    });
    describe('when an issue line number is a non-positive number', () => {
      it('should not display the line number', () => {
        // Act
        const result = getIacDisplayedIssues(resultFixtures, {
          shouldShowLineNumbers: true,
        });

        // Assert
        expect(result).toContain(
          `${colors.severities.high(
            `[High] ${chalk.bold('Hard coded secrets in EC2 metadata')}`,
          )}
  Info:    Secret keys have been hardcoded in user_data script. Anyone with
           access to VCS will be able to obtain the secret keys, and access the
           unauthorized resources
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-TF-123')}
  Path:    resource > aws_instance[denied_2] >
           user_data_base64[aws_access_key_id]
  File:    aws_ec2_metadata_secrets.tf
  Resolve: Remove secret value from \`user_data\` attribute`,
        );
      });
    });
  });
});
