import { startMockServer } from './helpers';

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

  it('scans custom rules provided via the --rules flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --rules=./iac/custom-rules/custom.tar.gz ./iac/terraform/sg_open_ssh.tf`,
    );
    expect(exitCode).toBe(1);

    expect(stdout).toContain('Testing sg_open_ssh.tf');
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain('Missing tags');
    expect(stdout).toContain('CUSTOM-123');
    expect(stdout).toContain(
      'introduced by resource > aws_security_group[allow_ssh] > tags',
    );
  });

  it('presents an error message when the rules cannot be found', async () => {
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
    expect(stdout).toContain(`Unsupported flag "--rules" provided`);
  });
});
