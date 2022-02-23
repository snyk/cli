import { startMockServer, isValidJSONString } from './helpers';
import * as path from 'path';

jest.setTimeout(50000);

describe('Terraform Language Support', () => {
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

  describe('without feature flag', () => {
    it('does not dereference variables', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform/var_deref`,
      );
      expect(exitCode).toBe(1);

      expect(stdout).toContain('Testing sg_open_ssh.tf...');
      expect(stdout).toContain('Infrastructure as code issues:');
      expect(stdout).not.toContain('✗ Security Group allows open ingress');
      expect(stdout).not.toContain(
        ' input > resource > aws_security_group[allow_ssh] > ingress',
      );
      expect(stdout).not.toContain(
        ' input > resource > aws_security_group[allow_ssh_terraform_tfvars] > ingress',
      );
      expect(stdout).not.toContain(
        ' input > resource > aws_security_group[allow_ssh_a_auto_tfvars] > ingress',
      );
      expect(stdout).not.toContain(
        ' input > resource > aws_security_group[allow_ssh_b_auto_tfvars] > ingress',
      );
    });
  });

  describe('with feature flag', () => {
    it('dereferences variables in the provided directory only', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test --org=tf-lang-support ./iac/terraform/var_deref`,
      );
      expect(exitCode).toBe(1);

      expect(stdout).toContain('Testing sg_open_ssh.tf...');
      expect(stdout).toContain('Infrastructure as code issues:');
      expect(stdout).toContain('✗ Security Group allows open ingress');
      expect(stdout).toContain(
        ' input > resource > aws_security_group[allow_ssh] > ingress',
      );
      expect(stdout).toContain(
        ' input > resource > aws_security_group[allow_ssh_terraform_tfvars] > ingress',
      );
      expect(stdout).toContain(
        ' input > resource > aws_security_group[allow_ssh_a_auto_tfvars] > ingress',
      );
      expect(stdout).toContain(
        ' input > resource > aws_security_group[allow_ssh_b_auto_tfvars] > ingress',
      );

      expect(stdout).not.toContain(
        'Testing nested-var_deref/sg_open_ssh.tf...',
      );
    });

    it('still scans other files but not terraform files nested in a directory', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test --org=tf-lang-support ./iac`,
      );
      expect(exitCode).toBe(1);

      expect(stdout).toContain('Infrastructure as code issues:');

      expect(stdout).toContain(
        `Testing ${path.join('kubernetes', 'pod-privileged.yaml')}`,
      );
      expect(stdout).toContain(
        `Tested ${path.join(
          'kubernetes',
          'pod-privileged.yaml',
        )} for known issues`,
      );

      expect(stdout).not.toContain(
        `Testing ${path.join('terraform', 'var_deref', 'sg_open_ssh.tf')}`,
      );
      expect(stdout).not.toContain(
        `Tested ${path.join(
          'terraform',
          'var_deref',
          'sg_open_ssh.tf',
        )} for known issues`,
      );
    });

    it('is backwards compatible without variable dereferencing', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test --org=tf-lang-support ./iac/terraform/sg_open_ssh.tf`,
      );
      expect(exitCode).toBe(1);

      expect(stdout).toContain('Testing ./iac/terraform/sg_open_ssh.tf');
      expect(stdout).toContain('Infrastructure as code issues:');
      expect(stdout).toContain('✗ Security Group allows open ingress');
      expect(stdout).toContain(
        ' input > resource > aws_security_group[allow_ssh] > ingress',
      );
    });

    it('filters out issues when using severity threshold', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test --org=tf-lang-support ./iac/terraform/sg_open_ssh.tf --severity-threshold=high`,
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Infrastructure as code issues:');
      expect(stdout).toContain(
        'Tested ./iac/terraform/sg_open_ssh.tf for known issues, found 0 issues',
      );
    });

    it('outputs an error for files with invalid HCL2', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test --org=tf-lang-support ./iac/terraform/sg_open_ssh_invalid_hcl2.tf`,
      );

      expect(exitCode).toBe(2);
      expect(stdout).toContain('We were unable to parse the Terraform file');
    });

    it('outputs the expected text when running with --sarif flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test --org=tf-lang-support ./iac/terraform/sg_open_ssh.tf --sarif`,
      );

      expect(exitCode).toBe(1);
      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).toContain('"id": "SNYK-CC-TF-1",');
      expect(stdout).toContain('"ruleId": "SNYK-CC-TF-1",');
    });

    it('outputs the expected text when running with --json flag', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test --org=tf-lang-support ./iac/terraform/sg_open_ssh.tf --json`,
      );

      expect(exitCode).toBe(1);
      expect(isValidJSONString(stdout)).toBe(true);
      expect(stdout).toContain('"id": "SNYK-CC-TF-1",');
      expect(stdout).toContain('"packageManager": "terraformconfig",');
      expect(stdout).toContain('"projectType": "terraformconfig",');
    });
  });
});
