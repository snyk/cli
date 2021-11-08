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
    expect(exitCode).toBe(1);

    expect(stdout).toContain('Testing ./iac/terraform/sg_open_ssh.tf');
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain('Missing tags');
    expect(stdout).toContain('CUSTOM-123');
    expect(stdout).toContain(
      'introduced by input > resource > aws_security_group[allow_ssh] > tags',
    );
  });

  it('presents an error message when the local rules cannot be found', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --rules=./not/a/real/path.tar.gz ./iac/terraform/sg_open_ssh.tf`,
    );

    expect(exitCode).toBe(2);
    expect(stdout).toContain(
      'We were unable to extract the rules provided at: ./not/a/real/path.tar.gz',
    );
  });

  it('presents an error message when the user is not part of the experiment', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --org=no-flag --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
    );

    expect(exitCode).toBe(2);
    expect(stdout).toContain(
      `Flag "--rules" is only supported if feature flag 'iacCustomRules' is enabled.`,
    );
  });
});

describe('custom rules pull from a remote OCI registry', () => {
  let run: (
    cmd: string,
    overrides?: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    const result = await startMockServer();
    run = result.run;
    teardown = result.teardown;
  });

  afterAll(async () => teardown());

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
  ];
  test.each(cases)(
    'given %p as a registry and correct credentials, it returns a success exit code',
    async (
      SNYK_CFG_OCI_REGISTRY_NAME,
      SNYK_CFG_OCI_REGISTRY_URL,
      SNYK_CFG_OCI_REGISTRY_USERNAME,
      SNYK_CFG_OCI_REGISTRY_PASSWORD,
    ) => {
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
      expect(exitCode).toBe(1);

      expect(stdout).toContain('Testing ./iac/terraform/sg_open_ssh.tf');
      expect(stdout).toContain('Infrastructure as code issues:');
      expect(stdout).toContain('Missing tags');
      expect(stdout).toContain('CUSTOM-1');
      expect(stdout).toContain(
        'introduced by input > resource > aws_security_group[allow_ssh] > tags',
      );
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

    expect(exitCode).toBe(2);
    expect(stdout).toContain(
      'There was an authentication error. Incorrect credentials provided.',
    );
  });

  it('presents an error message when there is a local and remote rules conflict', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh.tf --rules=bundle.tar.gz`,
      {
        SNYK_CFG_OCI_REGISTRY_URL:
          'https://registry-1.docker.io/fake-test-repo/bundle:latest',
      },
    );

    expect(exitCode).toBe(2);
    expect(stdout).toContain(
      'Remote and local custom rules bundle can not be used at the same time.',
    );
  });
});
