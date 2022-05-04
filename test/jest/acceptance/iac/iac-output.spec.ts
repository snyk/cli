import { EOL } from 'os';
import * as pathLib from 'path';

import { FakeServer } from '../../../acceptance/fake-server';
import { startMockServer } from './helpers';

const IAC_CLI_OUTPUT_FF = 'iacCliOutput';

jest.setTimeout(1000 * 30);

describe('iac test output', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
    overrides?: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => Promise<unknown>;

  const initialMessage =
    'Snyk testing Infrastructure as Code configuration issues...';

  beforeAll(async () => {
    ({ server, run, teardown } = await startMockServer());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await teardown();
  });

  describe(`with the '${IAC_CLI_OUTPUT_FF}' feature flag`, () => {
    beforeEach(() => {
      server.setFeatureFlag(IAC_CLI_OUTPUT_FF, true);
    });

    it('should show an initial message', async () => {
      const { stdout } = await run('snyk iac test  ./iac/arm/rule_test.json');
      expect(stdout).toContain(
        'Snyk testing Infrastructure as Code configuration issues...',
      );
    });

    it('should show the issues list section with correct values', async () => {
      const { stdout } = await run('snyk iac test  ./iac/arm/rule_test.json');

      expect(stdout).toContain(
        'Issues' +
          EOL.repeat(2) +
          'Medium Severity Issues: 1' +
          EOL.repeat(2) +
          '[Medium] Azure Firewall Network Rule Collection allows public access' +
          EOL +
          'Info:    That inbound traffic is allowed to a resource from any source instead of a restricted range. That potentially everyone can access your resource' +
          EOL +
          'Rule:    https://snyk.io/security-rules/SNYK-CC-TF-20' +
          EOL +
          'Path:    resources[1] > properties > networkRuleCollections[0] > properties > rules[0] > sourceAddresses' +
          EOL +
          'File:    ./iac/arm/rule_test.json' +
          EOL +
          'Resolve: Set `properties.networkRuleCollections.properties.rules.sourceAddresses` attribute to specific IP range only, e.g. `192.168.1.0/24`',
      );
    });

    it('should show the test summary section with correct values', async () => {
      // Arrange
      const dirPath = 'iac/kubernetes';
      const policyPath = `iac/policy/.snyk`;

      // Act
      const { stdout } = await run(
        `snyk iac test ${dirPath} --policy-path=${policyPath}`,
      );
      expect(stdout).toContain(
        'Test Summary' +
          EOL.repeat(2) +
          '  Organization: test-org' +
          EOL.repeat(2) +
          '✔ Files without issues: 0' +
          EOL +
          '✗ Files with issues: 3' +
          EOL +
          '  Ignored issues: 8' +
          EOL +
          '  Total issues: 28 [ 0 critical, 4 high, 8 medium, 16 low ]',
      );
    });

    it('should not show the file meta sections', async () => {
      // Arrange
      const dirPath = 'iac/arm';

      // Act
      const { stdout } = await run(`snyk iac test ${dirPath}`);

      // Assert
      expect(stdout).not.toContain(`
Type:              ARM
Target file:       ${dirPath}/`);
    });

    it('should not show the file summary messages', async () => {
      // Arrange
      const dirPath = 'iac/terraform';

      // Act
      const { stdout } = await run(`snyk iac test ${dirPath}`);

      // Assert
      expect(stdout).not.toContain(`Tested ${dirPath} for known issues`);
    });

    it('should not show the test failures section', async () => {
      // Arrange
      const dirPath = 'iac/only-valid';

      // Act
      const { stdout } = await run(`snyk iac test ${dirPath}`);

      // Assert
      expect(stdout).not.toContain('Invalid Files');
    });

    describe.each`
      dataFormat | dataFormatFlag
      ${'JSON'}  | ${'--json'}
      ${'SARIF'} | ${'--sarif'}
    `(
      'when providing the $dataFormatFlag flag',
      ({ dataFormat, dataFormatFlag }) => {
        it(`should not show an initial message for ${dataFormat} output`, async () => {
          const { stdout } = await run(
            `snyk iac test ${dataFormatFlag} ./iac/arm/rule_test.json`,
          );
          expect(stdout).not.toContain(initialMessage);
        });
      },
    );

    describe('with multiple test results', () => {
      describe('with test failures', () => {
        it('should show the failures list section with the correct values', async () => {
          // Arrange
          const dirPath = 'iac';

          // Act
          const { stdout } = await run(`snyk iac test ${dirPath}`);

          // Assert
          expect(stdout).toContain(
            'Failed to parse JSON file' +
              EOL +
              `Path: ${pathLib.join('iac', 'arm', 'invalid_rule_test.json')}` +
              EOL.repeat(2) +
              'Failed to parse YAML file' +
              EOL +
              `Path: ${pathLib.join(
                'iac',
                'cloudformation',
                'invalid-cfn.yml',
              )}` +
              EOL +
              `      ${pathLib.join('iac', 'kubernetes', 'helm-config.yaml')}` +
              EOL.repeat(2) +
              'Failed to parse Terraform file' +
              EOL +
              `Path: ${pathLib.join(
                'iac',
                'terraform',
                'sg_open_ssh_invalid_go_templates.tf',
              )}` +
              EOL +
              `      ${pathLib.join(
                'iac',
                'terraform',
                'sg_open_ssh_invalid_hcl2.tf',
              )}`,
          );
        });

        it('should include user tip for test failures', async () => {
          // Arrange
          const dirPath = 'iac/terraform';

          // Act
          const { stdout } = await run(`snyk iac test ${dirPath}`);

          // Assert
          expect(stdout).toContain(
            'Tip: Re-run in debug mode to see more information: DEBUG=*snyk* <COMMAND>' +
              EOL +
              'If the issue persists contact support@snyk.io',
          );
        });
      });
    });

    describe('with only test failures', () => {
      it('should display the failure reason for the first failed test', async () => {
        // Arrange
        const dirPath = 'iac/only-invalid';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).toContain(
          `Could not find any valid infrastructure as code files. Supported file extensions are tf, yml, yaml & json.
More information can be found by running \`snyk iac test --help\` or through our documentation:
https://support.snyk.io/hc/en-us/articles/360012429477-Test-your-Kubernetes-files-with-our-CLI-tool
https://support.snyk.io/hc/en-us/articles/360013723877-Test-your-Terraform-files-with-our-CLI-tool`,
        );
      });

      it('should not show the issues section', async () => {
        // Arrange
        const dirPath = 'iac/only-invalid';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).not.toContain('Issues');
      });

      it('should not show the test summary section', async () => {
        // Arrange
        const dirPath = 'iac/only-invalid';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).not.toContain('Test Summary');
      });
    });

    describe('with no issues', () => {
      it('it should display an appropriate message in the issues section', async () => {
        // Arrange
        const filePath = 'iac/terraform/vars.tf';

        // Act
        const { stdout } = await run(`snyk iac test ${filePath}`);

        // Assert
        expect(stdout).toContain('No vulnerable paths were found!');
      });
    });
  });

  describe(`without the '${IAC_CLI_OUTPUT_FF}' feature flag`, () => {
    it('should show the file meta sections for each file', async () => {
      // Arrange
      const filePath = 'iac/arm/rule_test.json';

      // Act
      const { stdout } = await run(`snyk iac test ${filePath}`);

      // Assert
      expect(stdout).toContain(`
Organization:      test-org
Type:              ARM
Target file:       ${filePath}
Project name:      arm
Open source:       no
Project path:      ${filePath}
`);
    });

    it('should show the file summary messages', async () => {
      // Arrange
      const dirPath = 'iac/terraform';

      // Act
      const { stdout } = await run(`snyk iac test ${dirPath}`);

      // Assert
      expect(stdout).toContain(
        'Tested sg_open_ssh.tf for known issues, found 1 issues',
      );
      expect(stdout).toContain(
        'Tested vars.tf for known issues, found 0 issues',
      );
      expect(stdout).toContain(
        `Tested ${pathLib.join(
          'var_deref',
          'sg_open_ssh.tf',
        )} for known issues, found 0 issues`,
      );
      expect(stdout).toContain(
        `Tested ${pathLib.join(
          'var_deref',
          'variables.tf',
        )} for known issues, found 0 issues`,
      );
      expect(stdout).toContain(
        `Tested ${pathLib.join(
          'var_deref',
          'nested_var_deref',
          'sg_open_ssh.tf',
        )} for known issues, found 0 issues`,
      );
      expect(stdout).toContain(
        `Tested ${pathLib.join(
          'var_deref',
          'nested_var_deref',
          'variables.tf',
        )} for known issues, found 0 issues`,
      );
    });

    it('should show the test summary message', async () => {
      // Arrange
      const dirPath = 'iac/kubernetes';

      // Act
      const { stdout } = await run(`snyk iac test ${dirPath}`);

      // Assert
      expect(stdout).toContain(
        'Tested 3 projects, 3 contained issues. Failed to test 1 project.',
      );
    });

    it('should not show an initial message', async () => {
      const { stdout } = await run('snyk iac test  ./iac/arm/rule_test.json');
      expect(stdout).not.toContain(initialMessage);
    });

    it('should not show a subtitle for medium severity issues', async () => {
      const { stdout } = await run('snyk iac test  ./iac/arm/rule_test.json');

      expect(stdout).not.toContain(
        'Issues' + EOL.repeat(2) + 'Medium Severity Issues: 1',
      );
    });

    it('should not show the test summary section', async () => {
      // Arrange
      const filePath = 'iac/kubernetes/pod-valid.json';

      // Act
      const { stdout } = await run(`snyk iac test ${filePath}`);

      // Assert
      expect(stdout).not.toContain('Test Summary');
    });

    it('should not show the test failures section', async () => {
      // Arrange
      const dirPath = 'iac/only-valid';

      // Act
      const { stdout } = await run(`snyk iac test ${dirPath}`);

      // Assert
      expect(stdout).not.toContain('Invalid Files');
    });

    describe('with multiple test results', () => {
      it('should show the test summary message', async () => {
        // Arrange
        const dirPath = 'iac/kubernetes';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).toContain('Tested 3 projects, 3 contained issues.');
      });

      describe('with test failures', () => {
        it('should show the failure reasons per file', async () => {
          // Arrange
          const dirPath = 'iac/terraform';

          // Act
          const { stdout } = await run(`snyk iac test ${dirPath}`);

          // Assert
          expect(stdout).toContain(
            `Testing sg_open_ssh_invalid_go_templates.tf...

Failed to parse Terraform file

-------------------------------------------------------

Testing sg_open_ssh_invalid_hcl2.tf...

Failed to parse Terraform file`,
          );
        });

        it('should include the failures count in the test summary message', async () => {
          // Arrange
          const dirPath = 'iac/kubernetes';

          // Act
          const { stdout } = await run(`snyk iac test ${dirPath}`);

          // Assert
          expect(stdout).toContain(
            'Tested 3 projects, 3 contained issues. Failed to test 1 project.',
          );
        });

        it('should include user tip for test failures', async () => {
          // Arrange
          const dirPath = 'iac/terraform';

          // Act
          const { stdout } = await run(`snyk iac test ${dirPath}`);

          // Assert
          expect(stdout).toContain(
            `Tip: Re-run in debug mode to see more information: DEBUG=*snyk* <COMMAND>
If the issue persists contact support@snyk.io`,
          );
        });
      });
    });

    describe('with only test failures', () => {
      it('should display the failure reason for the first failed test', async () => {
        // Arrange
        const dirPath = 'iac/only-invalid';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).toContain(
          `Could not find any valid infrastructure as code files. Supported file extensions are tf, yml, yaml & json.
More information can be found by running \`snyk iac test --help\` or through our documentation:
https://support.snyk.io/hc/en-us/articles/360012429477-Test-your-Kubernetes-files-with-our-CLI-tool
https://support.snyk.io/hc/en-us/articles/360013723877-Test-your-Terraform-files-with-our-CLI-tool`,
        );
      });

      it('should not show file issue lists', async () => {
        // Arrange
        const dirPath = 'iac/only-invalid';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).not.toContain('Infrastructure as code issues');
      });

      it('should not show the test summary section', async () => {
        // Arrange
        const dirPath = 'iac/only-invalid';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).not.toContain('Test Summary');
      });
    });
  });
});
