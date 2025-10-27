import { startMockServer } from './helpers';
import { FakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(50000);

describe('iac test --rules', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  let server: FakeServer;

  beforeAll(async () => {
    const result = await startMockServer();
    run = result.run;
    teardown = result.teardown;
    server = result.server;
  });

  afterAll(async () => teardown());

  it('scans local custom rules provided via the --rules flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
    );

    expect(stdout).toContain(
      'Using custom rules to generate misconfigurations.',
    );
    expect(stdout).toContain('File:    ./iac/terraform/sg_open_ssh.tf');
    expect(stdout).toContain('Missing tags');
    expect(stdout).toContain('CUSTOM-1');
    expect(stdout).toContain(
      'Path:    input > resource > aws_security_group[allow_ssh] > tags',
    );
    expect(exitCode).toBe(1);
  });

  it('does not show custom rules message if it scans local custom rules and uses --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf --json`,
    );
    expect(stdout).not.toContain(
      'Using custom rules to generate misconfigurations.',
    );
    expect(exitCode).toBe(1);
  });

  it('presents an error message when the local rules cannot be found', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --rules=./not/a/real/path.tar.gz ./iac/terraform/sg_open_ssh.tf`,
    );
    expect(stdout).toContain(
      'We were unable to extract the rules provided at: ./not/a/real/path.tar.gz',
    );
    expect(exitCode).toBe(2);
  });

  it('presents an error message when the user is not entitled to custom-rules', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --org=no-custom-rules-entitlements --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
    );
    expect(stdout).toContainText(
      `Flag "--rules" is currently not supported for this org. To enable it, please contact snyk support.`,
    );
    expect(exitCode).toBe(2);
  });

  describe('when used with the --report flag', () => {
    it('should resolve successfully', async () => {
      const { stderr, exitCode } = await run(
        `snyk iac test --report --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
      );
      expect(stderr).toEqual('');
      expect(exitCode).toEqual(1);
    });

    it('should display a message informing of the application of custom rules', async () => {
      const { stdout } = await run(
        `snyk iac test --report --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
      );

      expect(stdout).toContain(
        'Using custom rules to generate misconfigurations.',
      );
    });

    it('should display a warning message for custom rules not being available on the platform if iacShareCliResultsCustomRules feature flag is not enabled', async () => {
      server.setFeatureFlag('iacShareCliResultsCustomRules', false);

      const { stdout } = await run(
        `snyk iac test --report --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
      );

      expect(stdout).toContain(
        "Please note that your custom rules will not be sent to the Snyk platform, and will not be available on the project's page.",
      );
    });

    it('should not display a warning message for custom rules not being available on the platform if iacShareCliResultsCustomRules feature flag is enabled', async () => {
      server.setFeatureFlag('iacShareCliResultsCustomRules', true);

      const { stdout } = await run(
        `snyk iac test --report --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
      );

      expect(stdout).not.toContain(
        "Please note that your custom rules will not be sent to the Snyk platform, and will not be available on the project's page.",
      );
    });

    describe.each(['--json', '--sarif'])(
      'when the %s flag is provided',
      (testedFormatFlag) => {
        it('should not display the warning message for the custom rules not being available on the platform', async () => {
          server.setFeatureFlag('iacShareCliResultsCustomRules', false);

          const { stdout } = await run(
            `snyk iac test --report --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf ${testedFormatFlag}`,
          );

          expect(stdout).not.toContain(
            "Please note that your custom rules will not be sent to the Snyk platform, and will not be available on the project's page.",
          );
        });
      },
    );
  });
});
