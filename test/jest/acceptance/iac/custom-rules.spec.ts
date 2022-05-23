import { execSync } from 'child_process';
import { startMockServer } from './helpers';

jest.setTimeout(50000);

describe('iac test --rules', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    const result = await startMockServer();
    run = result.run;
    teardown = result.teardown;
  });

  afterAll(async () => teardown());

  it('scans local custom rules provided via the --rules flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
    );

    expect(stdout).toContain(
      'Using custom rules to generate misconfigurations.',
    );
    expect(stdout).toContain('Testing ./iac/terraform/sg_open_ssh.tf');
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain('Missing tags');
    expect(stdout).toContain('CUSTOM-1');
    expect(stdout).toContain(
      'introduced by input > resource > aws_security_group[allow_ssh] > tags',
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
    expect(stdout).toContain(
      `Flag "--rules" is currently not supported for this org. To enable it, please contact snyk support.`,
    );
    expect(exitCode).toBe(2);
  });

  describe.each([
    ['--report flag', 'test --report'],
    ['report command', 'report'],
  ])('when used with the %s', (_, testedCommand) => {
    it('should resolve successfully', async () => {
      const { stderr, exitCode } = await run(
        `snyk iac ${testedCommand} --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
      );
      expect(stderr).toEqual('');
      expect(exitCode).toEqual(1);
    });

    it('should display a message informing of the application of custom rules', async () => {
      const { stdout } = await run(
        `snyk iac ${testedCommand} --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
      );

      expect(stdout).toContain(
        'Using custom rules to generate misconfigurations.',
      );
    });

    it('should display a warning message for custom rules not being available on the platform', async () => {
      const { stdout } = await run(
        `snyk iac ${testedCommand} --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
      );

      expect(stdout).toContain(
        "Please note that your custom rules will not be sent to the Snyk platform, and will not be available on the project's page.",
      );
    });

    describe.each(['--json', '--sarif'])(
      'when the %s flag is provided',
      (testedFormatFlag) => {
        it('should not display the warning message for the custom rules not being available on the platform', async () => {
          const { stdout } = await run(
            `snyk iac ${testedCommand} --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf ${testedFormatFlag}`,
          );

          expect(stdout).not.toContain(
            "Please note that your custom rules will not be sent to the Snyk platform, and will not be available on the project's page.",
          );
        });
      },
    );
  });
});

// skipping this as we have many flakes recently
// to be re-written in CFG-1847
describe.skip('custom rules pull from a remote OCI registry', () => {
  let run: (
    cmd: string,
    overrides?: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => Promise<unknown>;

  beforeAll(async () => {
    const result = await startMockServer();
    run = result.run;
    teardown = result.teardown;
  });

  afterAll(async () => await teardown());

  const getOciElasticRegistryPassword = () => {
    const awsCommand =
      process.platform === 'win32'
        ? 'aws ecr get-login --region eu-west-1'
        : 'aws ecr get-login-password --region eu-west-1';
    let result = execSync(awsCommand, {
      env: {
        AWS_ACCESS_KEY_ID: process.env.OCI_ELASTIC_REGISTRY_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY:
          process.env.OCI_ELASTIC_REGISTRY_SECRET_ACCESS_KEY,
      },
    }).toString();
    if (process.platform === 'win32') {
      // the command has a "docker login -u AWS -p " prefix
      const prefix = 'docker login -u AWS -p';
      // and a " -e none <url>" postifx
      const postfix = ` -e none https://${
        new URL(process.env.OCI_ELASTIC_REGISTRY_URL || '').hostname
      }`;
      result = result.substring(
        prefix.length + 1,
        result.length - postfix.length - 2,
      );
    }
    return result;
  };

  const cases = [
    [
      'Docker',
      process.env.OCI_DOCKER_REGISTRY_URL,
      process.env.OCI_DOCKER_REGISTRY_USERNAME,
      process.env.OCI_DOCKER_REGISTRY_PASSWORD,
    ],
    [
      'Azure',
      process.env.OCI_AZURE_REGISTRY_URL,
      process.env.OCI_AZURE_REGISTRY_USERNAME,
      process.env.OCI_AZURE_REGISTRY_PASSWORD,
    ],
    [
      'Harbor',
      process.env.OCI_HARBOR_REGISTRY_URL,
      process.env.OCI_HARBOR_REGISTRY_USERNAME,
      process.env.OCI_HARBOR_REGISTRY_PASSWORD,
    ],
    [
      'Elastic',
      process.env.OCI_ELASTIC_REGISTRY_URL,
      'AWS',
      getOciElasticRegistryPassword(),
    ],
    [
      'GitHub',
      process.env.OCI_GITHUB_REGISTRY_URL,
      process.env.OCI_GITHUB_REGISTRY_USERNAME,
      process.env.OCI_GITHUB_REGISTRY_PASSWORD,
    ],
    // [
    //   'GCR',
    //   process.env.OCI_GCR_REGISTRY_URL,
    //   process.env.OCI_GCR_REGISTRY_USERNAME,
    //   process.env.OCI_GCR_REGISTRY_PASSWORD,
    // ],
  ];

  describe.each(cases)(
    'given %p as a registry and correct credentials',
    (
      SNYK_CFG_OCI_REGISTRY_NAME,
      SNYK_CFG_OCI_REGISTRY_URL,
      SNYK_CFG_OCI_REGISTRY_USERNAME,
      SNYK_CFG_OCI_REGISTRY_PASSWORD,
    ) => {
      it('should return a success exit code', async () => {
        const { stdout, exitCode } = await run(
          `snyk iac test ./iac/terraform/sg_open_ssh.tf`,
          {
            SNYK_CFG_OCI_REGISTRY_URL: SNYK_CFG_OCI_REGISTRY_URL as string,
            SNYK_CFG_OCI_REGISTRY_USERNAME: SNYK_CFG_OCI_REGISTRY_USERNAME as string,
            SNYK_CFG_OCI_REGISTRY_PASSWORD: SNYK_CFG_OCI_REGISTRY_PASSWORD as string,
          },
        );
        expect(SNYK_CFG_OCI_REGISTRY_URL).toBeDefined();
        expect(SNYK_CFG_OCI_REGISTRY_USERNAME).toBeDefined();
        expect(SNYK_CFG_OCI_REGISTRY_PASSWORD).toBeDefined();

        expect(stdout).toContain(
          'Using custom rules to generate misconfigurations.',
        );
        expect(stdout).toContain('Testing ./iac/terraform/sg_open_ssh.tf');
        expect(stdout).toContain('Infrastructure as code issues:');
        expect(stdout).toContain('Missing tags');
        expect(stdout).toContain('CUSTOM-1');
        expect(stdout).toContain(
          'introduced by input > resource > aws_security_group[allow_ssh] > tags',
        );
        expect(exitCode).toBe(1);
      });

      describe.each([
        ['--report flag', 'test --report'],
        ['report command', 'report'],
      ])('when used with the %s', (_, testedCommand) => {
        it('should resolve successfully', async () => {
          const { exitCode, stderr } = await run(
            `snyk iac ${testedCommand} ./iac/terraform/sg_open_ssh.tf`,
            {
              SNYK_CFG_OCI_REGISTRY_URL: SNYK_CFG_OCI_REGISTRY_URL as string,
              SNYK_CFG_OCI_REGISTRY_USERNAME: SNYK_CFG_OCI_REGISTRY_USERNAME as string,
              SNYK_CFG_OCI_REGISTRY_PASSWORD: SNYK_CFG_OCI_REGISTRY_PASSWORD as string,
            },
          );
          expect(stderr).toContain('');
          expect(exitCode).toEqual(1);
        });

        it('should display a message informing of the application of custom rules', async () => {
          const { stdout } = await run(
            `snyk iac ${testedCommand} ./iac/terraform/sg_open_ssh.tf`,
            {
              SNYK_CFG_OCI_REGISTRY_URL: SNYK_CFG_OCI_REGISTRY_URL as string,
              SNYK_CFG_OCI_REGISTRY_USERNAME: SNYK_CFG_OCI_REGISTRY_USERNAME as string,
              SNYK_CFG_OCI_REGISTRY_PASSWORD: SNYK_CFG_OCI_REGISTRY_PASSWORD as string,
            },
          );

          expect(stdout).toContain(
            'Using custom rules to generate misconfigurations.',
          );
        });

        it('should display a warning message for custom rules not being available on the platform', async () => {
          const { stdout } = await run(
            `snyk iac ${testedCommand} ./iac/terraform/sg_open_ssh.tf`,
            {
              SNYK_CFG_OCI_REGISTRY_URL: SNYK_CFG_OCI_REGISTRY_URL as string,
              SNYK_CFG_OCI_REGISTRY_USERNAME: SNYK_CFG_OCI_REGISTRY_USERNAME as string,
              SNYK_CFG_OCI_REGISTRY_PASSWORD: SNYK_CFG_OCI_REGISTRY_PASSWORD as string,
            },
          );

          expect(stdout).toContain(
            "Please note that your custom rules will not be sent to the Snyk platform, and will not be available on the project's page.",
          );
        });

        describe.each(['--json', '--sarif'])(
          'when the %s flag is provided',
          (testedFormatFlag) => {
            it('should not display the warning message for the custom rules not being available on the platform', async () => {
              const { stdout } = await run(
                `snyk iac ${testedCommand} ./iac/terraform/sg_open_ssh.tf ${testedFormatFlag}`,
                {
                  SNYK_CFG_OCI_REGISTRY_URL: SNYK_CFG_OCI_REGISTRY_URL as string,
                  SNYK_CFG_OCI_REGISTRY_USERNAME: SNYK_CFG_OCI_REGISTRY_USERNAME as string,
                  SNYK_CFG_OCI_REGISTRY_PASSWORD: SNYK_CFG_OCI_REGISTRY_PASSWORD as string,
                },
              );

              expect(stdout).not.toContain(
                "Please note that your custom rules will not be sent to the Snyk platform, and will not be available on the project's page.",
              );
            });
          },
        );
      });
    },
  );

  it('presents an error message when there is an issue downloading the remote rules', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh.tf`,
      {
        SNYK_CFG_OCI_REGISTRY_URL:
          'https://registry-1.docker.io/fake-repo-test/bundle:latest',
      },
    );

    expect(stdout).toContain(
      'There was an authentication error. Incorrect credentials provided.',
    );
    expect(exitCode).toBe(2);
  });

  it('presents an error message when there is a local and remote rules conflict', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh.tf --rules=bundle.tar.gz`,
      {
        SNYK_CFG_OCI_REGISTRY_URL:
          'https://registry-1.docker.io/fake-test-repo/bundle:latest',
      },
    );

    expect(stdout).toContain(
      'Remote and local custom rules bundle can not be used at the same time.',
    );
    expect(exitCode).toBe(2);
  });

  it('presents an error message when the user is not entitled to custom-rules', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --org=no-custom-rules-entitlements ./iac/terraform/sg_open_ssh.tf`,
      {
        SNYK_CFG_OCI_REGISTRY_URL: process.env.OCI_DOCKER_REGISTRY_URL!,
        SNYK_CFG_OCI_REGISTRY_USERNAME: process.env
          .OCI_DOCKER_REGISTRY_USERNAME!,
        SNYK_CFG_OCI_REGISTRY_PASSWORD: process.env
          .OCI_DOCKER_REGISTRY_PASSWORD!,
      },
    );

    expect(stdout).toContain(
      `The custom rules feature is currently not supported for this org. To enable it, please contact snyk support.`,
    );
    expect(exitCode).toBe(2);
  });
});
