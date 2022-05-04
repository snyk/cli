import * as fs from 'fs';
import * as pathLib from 'path';
import chalk from 'chalk';
import { IacOutputMeta } from '../../../../../../../../src/lib/types';
import { getIacDisplayedIssues } from '../../../../../../../../src/lib/formatters/iac-output';
import { colors } from '../../../../../../../../src/lib/formatters/iac-output/v2/color-utils';
import { FormattedResult } from '../../../../../../../../src/cli/commands/test/iac/local-execution/types';

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

  it('should include the correct issues in each severity section, and display the correct issue details', () => {
    // Arrange
    const testFormattedResults = resultFixtures.slice(2, 4);

    // Act
    const result = getIacDisplayedIssues(testFormattedResults, outputMeta);

    // Assert
    expect(result).toContain(
      `${colors.severities.low(
        `[Low] ${chalk.bold('Container is running without AppArmor profile')}`,
      )}
Info:    The AppArmor profile is not set correctly. AppArmor will not enforce mandatory access control, which can increase the attack vectors.
Rule:    https://snyk.io/security-rules/SNYK-CC-K8S-32
Path:    [DocId: 0] > metadata > annotations['container.apparmor.security.beta.kubernetes.io/web']
File:    k8s.yaml
Resolve: Add \`container.apparmor.security.beta.kubernetes.io/<container-name>\` annotation with value \`runtime/default\` or \`localhost/<name-of-profile\`

${colors.severities.low(
  `[Low] ${chalk.bold('Container is running without memory limit')}`,
)}
Info:    Memory limit is not defined. Containers without memory limits are more likely to be terminated when the node runs out of memory
Rule:    https://snyk.io/security-rules/SNYK-CC-K8S-4
Path:    [DocId: 0] > input > spec > template > spec > containers[web] > resources > limits > memory
File:    k8s.yaml
Resolve: Set \`resources.limits.memory\` value

${colors.severities.low(
  `[Low] ${chalk.bold('Container could be running with outdated image')}`,
)}
Info:    The image policy does not prevent image reuse. The container may run with outdated or unauthorized image
Rule:    https://snyk.io/security-rules/SNYK-CC-K8S-42
Path:    [DocId: 0] > spec > template > spec > containers[web] > imagePullPolicy
File:    k8s.yaml
Resolve: Set \`imagePullPolicy\` attribute to \`Always\`

${colors.severities.low(
  `[Low] ${chalk.bold('Container is running without cpu limit')}`,
)}
Info:    CPU limit is not defined. Containers without limits can exceed the capacity of the node, and affect availability/performance of the host and other containers.
Rule:    https://snyk.io/security-rules/SNYK-CC-K8S-5
Path:    [DocId: 0] > input > spec > template > spec > containers[web] > resources > limits > cpu
File:    k8s.yaml
Resolve: Add \`resources.limits.cpu\` field with required CPU limit value

${colors.severities.low(
  `[Low] ${chalk.bold('Container is running with writable root filesystem')}`,
)}
Info:    \`readOnlyRootFilesystem\` attribute is not set to \`true\`. Compromised process could abuse writable root filesystem to elevate privileges
Rule:    https://snyk.io/security-rules/SNYK-CC-K8S-8
Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > readOnlyRootFilesystem
File:    k8s.yaml
Resolve: Set \`securityContext.readOnlyRootFilesystem\` to \`true\``,
    );

    expect(result).toContain(
      `${colors.severities.medium(
        `[Medium] ${chalk.bold(
          'Container is running without root user control',
        )}`,
      )}
Info:    Container is running without root user control. Container could be running with full administrative privileges
Rule:    https://snyk.io/security-rules/SNYK-CC-K8S-10
Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > runAsNonRoot
File:    k8s.yaml
Resolve: Set \`securityContext.runAsNonRoot\` to \`true\`

${colors.severities.medium(
  `[Medium] ${chalk.bold('Container does not drop all default capabilities')}`,
)}
Info:    All default capabilities are not explicitly dropped. Containers are running with potentially unnecessary privileges
Rule:    https://snyk.io/security-rules/SNYK-CC-K8S-6
Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > capabilities > drop
File:    k8s.yaml
Resolve: Add \`ALL\` to \`securityContext.capabilities.drop\` list, and add only required capabilities in \`securityContext.capabilities.add\`

${colors.severities.medium(
  `[Medium] ${chalk.bold(
    'Container is running without privilege escalation control',
  )}`,
)}
Info:    \`allowPrivilegeEscalation\` attribute is not set to \`false\`. Processes could elevate current privileges via known vectors, for example SUID binaries
Rule:    https://snyk.io/security-rules/SNYK-CC-K8S-9
Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > allowPrivilegeEscalation
File:    k8s.yaml
Resolve: Set \`securityContext.allowPrivilegeEscalation\` to \`false\``,
    );

    expect(result).toContain(
      `${colors.severities.high(
        `[High] ${chalk.bold('Container is running in privileged mode')}`,
      )}
Info:    Container is running in privileged mode. Compromised container could potentially modify the underlying host’s kernel by loading unauthorized modules (i.e. drivers).
Rule:    https://snyk.io/security-rules/SNYK-CC-K8S-1
Path:    [DocId: 0] > input > spec > template > spec > containers[web] > securityContext > privileged
File:    k8s.yaml
Resolve: Remove \`securityContext.privileged\` attribute, or set value to \`false\``,
    );
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
