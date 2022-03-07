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

      // expect exitCode to be 0 or 1
      expect(exitCode).toBeLessThanOrEqual(1);

      expect(stdout).toContain('Testing sg_open_ssh.tf...');
      expect(stdout.match(/✗ Security Group allows open ingress/g)).toBeNull();
      expect(stdout).toContain('Tested sg_open_ssh.tf for known issues');

      expect(stdout).toContain(
        `Testing ${path.join('nested_var_deref', 'sg_open_ssh.tf')}...`,
      );
      expect(stdout.match(/✗ Rule allows open egress/g)).toBeNull();
      expect(stdout).toContain(
        `Tested ${path.join(
          'nested_var_deref',
          'sg_open_ssh.tf',
        )} for known issues`,
      );
    });
  });

  describe('with feature flag', () => {
    // TODO: can be merged with the existing test-terraform.spec.ts when the flag is removed
    describe('files', () => {
      it('finds issues in Terraform file', async () => {
        const { stdout, exitCode } = await run(
          `snyk iac test --org=tf-lang-support iac/terraform/var_deref/sg_open_ssh.tf`,
        );

        expect(exitCode).toBe(1);

        expect(stdout).toContain(
          'Testing iac/terraform/var_deref/sg_open_ssh.tf...',
        );
        expect(
          stdout.match(/✗ Security Group allows open ingress/g),
        ).toHaveLength(1);
        expect(stdout).toContain(
          'Tested iac/terraform/var_deref/sg_open_ssh.tf for known issues',
        );
      });

      it('finds no issues in empty Terraform file', async () => {
        const { exitCode } = await run(
          `snyk iac test --org=tf-lang-support ./iac/terraform/empty_file.tf`,
        );

        expect(exitCode).toBe(0);
      });
    });

    describe('directories', () => {
      it('dereferences variables in nested directories', async () => {
        const { stdout, exitCode } = await run(
          `snyk iac test --org=tf-lang-support ./iac/terraform/var_deref`,
        );

        expect(exitCode).toBe(1);

        expect(stdout).toContain('Testing sg_open_ssh.tf...');
        expect(
          stdout.match(/✗ Security Group allows open ingress/g),
        ).toHaveLength(5);
        expect(stdout).toContain('Tested sg_open_ssh.tf for known issues');

        expect(stdout).toContain(
          `Testing ${path.join('nested_var_deref', 'sg_open_ssh.tf')}...`,
        );
        expect(stdout.match(/✗ Rule allows open egress/g)).toHaveLength(1);
        expect(stdout).toContain(
          `Tested ${path.join(
            'nested_var_deref',
            'sg_open_ssh.tf',
          )} for known issues`,
        );
      });

      //TODO: add another test that checks a folder with edge cases

      it('scans a mix of IaC files in nested directories', async () => {
        const { stdout, exitCode } = await run(
          `snyk iac test --org=tf-lang-support ./iac`,
        );

        expect(exitCode).toBe(1);

        expect(stdout).toContain(
          `Testing ${path.join('kubernetes', 'pod-privileged.yaml')}`,
        );
        expect(stdout).toContain(
          `Tested ${path.join(
            'kubernetes',
            'pod-privileged.yaml',
          )} for known issues`,
        );

        expect(stdout).toContain(
          `Testing ${path.join('terraform', 'var_deref', 'sg_open_ssh.tf')}`,
        );
        expect(
          stdout.match(/✗ Security Group allows open ingress/g),
        ).toHaveLength(8);
        expect(stdout).toContain(
          `Tested ${path.join(
            'terraform',
            'var_deref',
            'sg_open_ssh.tf',
          )} for known issues`,
        );

        expect(stdout).toContain(
          `Testing ${path.join(
            'terraform',
            'var_deref',
            'nested_var_deref',
            'sg_open_ssh.tf',
          )}...`,
        );
        expect(stdout.match(/✗ Rule allows open egress/g)).toHaveLength(1);
        expect(stdout).toContain(
          `Tested ${path.join(
            'terraform',
            'var_deref',
            'nested_var_deref',
            'sg_open_ssh.tf',
          )} for known issues`,
        );
      });
    });

    describe('other functions', () => {
      it('is backwards compatible without variable dereferencing', async () => {
        const { stdout, exitCode } = await run(
          `snyk iac test --org=tf-lang-support iac/terraform/sg_open_ssh.tf`,
        );

        expect(exitCode).toBe(1);

        expect(stdout).toContain('Testing iac/terraform/sg_open_ssh.tf...');
        expect(
          stdout.match(/✗ Security Group allows open ingress/g),
        ).toHaveLength(1);
        expect(stdout).toContain(
          'Tested iac/terraform/sg_open_ssh.tf for known issues',
        );
      });

      it('filters out issues when using severity threshold', async () => {
        const { stdout, exitCode } = await run(
          `snyk iac test --org=tf-lang-support iac/terraform/sg_open_ssh.tf --severity-threshold=high`,
        );

        // expect exitCode to be 0 or 1
        expect(exitCode).toBeLessThanOrEqual(1);

        expect(stdout).toContain('Testing iac/terraform/sg_open_ssh.tf...');
        expect(
          stdout.match(/✗ Security Group allows open ingress/g),
        ).toBeNull();
        expect(stdout).toContain(
          'Tested iac/terraform/sg_open_ssh.tf for known issues',
        );
      });

      it('filters out issues when using detection depth', async () => {
        const { stdout, exitCode } = await run(
          `snyk iac test --org=tf-lang-support ./iac/terraform/ --detection-depth=2`,
        );

        expect(exitCode).toBe(1);

        expect(stdout).toContain(
          `Testing ${path.join('var_deref', 'sg_open_ssh.tf')}`,
        );
        expect(stdout).toContain(
          `Tested ${path.join('var_deref', 'sg_open_ssh.tf')} for known issues`,
        );
        expect(stdout).toContain(`Testing ${path.join('sg_open_ssh.tf')}`);
        expect(stdout).toContain('Tested sg_open_ssh.tf for known issues');
        expect(
          stdout.match(/✗ Security Group allows open ingress/g),
        ).toHaveLength(6);

        // Check that we didn't scan directories with depth > 2
        expect(stdout).not.toContain(
          `Testing ${path.join(
            'var_deref',
            'nested_var_deref',
            'sg_open_ssh.tf',
          )}...`,
        );
        expect(stdout.match(/✗ Rule allows open egress/g)).toBeNull();
        expect(stdout).not.toContain(
          `Tested ${path.join(
            'var_deref',
            'nested_var_deref',
            'sg_open_ssh.tf',
          )} for known issues`,
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
});
