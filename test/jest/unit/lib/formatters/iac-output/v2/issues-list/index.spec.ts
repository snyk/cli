import * as fs from 'fs';
import * as pathLib from 'path';
import chalk from 'chalk';
import { getIacDisplayedIssues } from '../../../../../../../../src/lib/formatters/iac-output';
import { colors } from '../../../../../../../../src/lib/formatters/iac-output/v2/utils';
import { FormattedOutputResultsBySeverity } from '../../../../../../../../src/lib/formatters/iac-output/v2/types';

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
        `[Low] ${chalk.bold('Container is running without AppArmor profile')}`,
      )}
  Info:    The AppArmor profile is not set correctly. AppArmor will not enforce mandatory access control, which can increase the attack vectors.
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-32')}
  Path:    [DocId: 0] > metadata > annotations['container.apparmor.security.beta.kubernetes.io/web']
  File:    k8s.yaml
  Resolve: Add \`container.apparmor.security.beta.kubernetes.io/<container-name>\` annotation with value \`runtime/default\` or \`localhost/<name-of-profile\`

  ${colors.severities.low(
    `[Low] ${chalk.bold('Container is running without memory limit')}`,
  )}
  Info:    Memory limit is not defined. Containers without memory limits are more likely to be terminated when the node runs out of memory
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-4')}
  Path:    [DocId: 0] > input > spec > template > spec > containers[web] > resources > limits > memory
  File:    k8s.yaml
  Resolve: Set \`resources.limits.memory\` value

  ${colors.severities.low(
    `[Low] ${chalk.bold('Container could be running with outdated image')}`,
  )}
  Info:    The image policy does not prevent image reuse. The container may run with outdated or unauthorized image
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-42')}
  Path:    [DocId: 0] > spec > template > spec > containers[web] > imagePullPolicy
  File:    k8s.yaml
  Resolve: Set \`imagePullPolicy\` attribute to \`Always\`

  ${colors.severities.low(
    `[Low] ${chalk.bold('Container is running without cpu limit')}`,
  )}
  Info:    CPU limit is not defined. Containers without limits can exceed the capacity of the node, and affect availability/performance of the host and other containers.
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-5')}
  Path:    [DocId: 0] > input > spec > template > spec > containers[web] > resources > limits > cpu
  File:    k8s.yaml
  Resolve: Add \`resources.limits.cpu\` field with required CPU limit value

  ${colors.severities.low(
    `[Low] ${chalk.bold('Container is running with writable root filesystem')}`,
  )}
  Info:    \`readOnlyRootFilesystem\` attribute is not set to \`true\`. Compromised process could abuse writable root filesystem to elevate privileges
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-8')}
  Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > readOnlyRootFilesystem
  File:    k8s.yaml
  Resolve: Set \`securityContext.readOnlyRootFilesystem\` to \`true\``,
    );

    expect(result).toContain(
      `  ${colors.severities.medium(
        `[Medium] ${chalk.bold(
          'Container is running without root user control',
        )}`,
      )}
  Info:    Container is running without root user control. Container could be running with full administrative privileges
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-10')}
  Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > runAsNonRoot
  File:    k8s.yaml
  Resolve: Set \`securityContext.runAsNonRoot\` to \`true\`

  ${colors.severities.medium(
    `[Medium] ${chalk.bold(
      'Container does not drop all default capabilities',
    )}`,
  )}
  Info:    All default capabilities are not explicitly dropped. Containers are running with potentially unnecessary privileges
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-6')}
  Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > capabilities > drop
  File:    k8s.yaml
  Resolve: Add \`ALL\` to \`securityContext.capabilities.drop\` list, and add only required capabilities in \`securityContext.capabilities.add\`

  ${colors.severities.medium(
    `[Medium] ${chalk.bold(
      'Container is running without privilege escalation control',
    )}`,
  )}
  Info:    \`allowPrivilegeEscalation\` attribute is not set to \`false\`. Processes could elevate current privileges via known vectors, for example SUID binaries
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-9')}
  Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > allowPrivilegeEscalation
  File:    k8s.yaml
  Resolve: Set \`securityContext.allowPrivilegeEscalation\` to \`false\``,
    );

    expect(result).toContain(
      `  ${colors.severities.high(
        `[High] ${chalk.bold('Container is running in privileged mode')}`,
      )}
  Info:    Container is running in privileged mode. Compromised container could potentially modify the underlying host’s kernel by loading unauthorized modules (i.e. drivers).
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-K8S-1')}
  Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > privileged
  File:    k8s.yaml
  Resolve: Remove \`securityContext.privileged\` attribute, or set value to \`false\``,
    );
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
  Info:    To prevent instance from being accidentally terminated using Amazon EC2, you can enable termination protection for the instance. Without this setting enabled the instances can be terminated by accident. This setting should only be used for instances with high availability requirements. Enabling this may prevent IaC workflows from updating the instance, for example terraform will not be able to terminate the instance to update instance type
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
  Info:    Secret keys have been hardcoded in user_data script. Anyone with access to VCS will be able to obtain the secret keys, and access the unauthorized resources
  Rule:    ${chalk.underline('https://snyk.io/security-rules/SNYK-CC-TF-123')}
  Path:    resource > aws_instance[denied_2] > user_data_base64[aws_access_key_id]
  File:    aws_ec2_metadata_secrets.tf
  Resolve: Remove secret value from \`user_data\` attribute`,
        );
      });
    });
  });
});
