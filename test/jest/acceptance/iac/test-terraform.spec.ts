import { startMockServer, isValidJSONString } from './helpers';

jest.setTimeout(50000);

describe('Terraform single file scan', () => {
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

  it('finds issues in Terraform file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh.tf`,
    );
    expect(stdout).toContain('Testing ./iac/terraform/sg_open_ssh.tf');
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain('✗ Security Group allows open ingress');
    expect(stdout).toContain(
      ' input > resource > aws_security_group[allow_ssh] > ingress',
    );
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh.tf --severity-threshold=high`,
    );

    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain(
      'Tested ./iac/terraform/sg_open_ssh.tf for known issues, found 0 issues',
    );
    expect(exitCode).toBe(0);
  });

  it('outputs an error for files with invalid HCL2', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh_invalid_hcl2.tf`,
    );
    expect(stdout).toContain('We were unable to parse the Terraform file');
    expect(exitCode).toBe(2);
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh.tf --sarif`,
    );
    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-TF-1",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-TF-1",');
    expect(exitCode).toBe(1);
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh.tf --json`,
    );
    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-TF-1",');
    expect(stdout).toContain('"packageManager": "terraformconfig",');
    expect(stdout).toContain('"projectType": "terraformconfig",');
    expect(exitCode).toBe(1);
  });
});
