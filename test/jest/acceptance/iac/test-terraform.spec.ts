import { isValidJSONString, startMockServer } from './helpers';
import * as path from 'path';
import { EOL } from 'os';
import { FakeServer } from '../../../acceptance/fake-server';
import { FailedToParseTerraformFileError } from '../../../../src/cli/commands/test/iac/local-execution/parsers/terraform-file-parser';
import { InvalidVarFilePath } from '../../../../src/cli/commands/test/iac/local-execution';

jest.setTimeout(50000);

describe('Terraform', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    const result = await startMockServer();
    run = result.run;
    teardown = result.teardown;
    server = result.server;
  });

  afterAll(async () => teardown());

  afterEach(() => {
    server.restore();
  });

  describe('Terraform single file scans', () => {
    it('finds issues in Terraform file', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform/sg_open_ssh.tf`,
      );
      expect(stdout).toContain('File:    ./iac/terraform/sg_open_ssh.tf');
      expect(stdout).toContain('Security Group allows open ingress');
      expect(stdout).toContain(
        'Path:    input > resource > aws_security_group[allow_ssh] > ingress',
      );
      expect(exitCode).toBe(1);
    });

    it('filters out issues when using severity threshold', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform/sg_open_ssh.tf --severity-threshold=high`,
      );

      expect(stdout).toContain('No vulnerable paths were found!');
      expect(exitCode).toBe(0);
    });

    it('outputs an error for files with invalid HCL2', async () => {
      const path = './iac/terraform/sg_open_ssh_invalid_hcl2.tf';
      const { stdout, exitCode } = await run(`snyk iac test ${path}`);
      expect(stdout).toContainText(
        new FailedToParseTerraformFileError(path).message,
      );
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
    it('returns error empty Terraform file', async () => {
      const { exitCode } = await run(
        `snyk iac test ./iac/terraform/empty_file.tf`,
      );
      expect(exitCode).toBe(3);
    });

    describe('when the iacNewEngine feature flag is enabled', () => {
      beforeAll(() => {
        server.setFeatureFlag('iacNewEngine', true);
      });
      it('uses the new engine, hence the new policies are used', async () => {
        const { stdout, exitCode } = await run(
          `snyk iac test ./iac/terraform/sg_open_ssh.tf --json`,
        );

        expect(isValidJSONString(stdout)).toBe(true);

        const jsonOut = JSON.parse(stdout);
        expect(jsonOut).toHaveLength(1);

        const issues: any[] = jsonOut[0]?.infrastructureAsCodeIssues;
        expect(issues).toHaveLength(2);

        const sortedIds = issues.map((issue) => issue.id).sort();
        expect(sortedIds).toEqual(['SNYK-CC-00110', 'SNYK-CC-00747']);
        expect(exitCode).toBe(1);
      });
    });
  });

  describe('Terraform directories', () => {
    it('dereferences variables in nested directories', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform/var_deref`,
      );

      expect(stdout.match(/Security Group allows open ingress/g)).toHaveLength(
        5,
      );
      expect(stdout).toContain('File:    sg_open_ssh.tf');

      expect(stdout).toContain(
        `File:    ${path.join('nested_var_deref', 'sg_open_ssh.tf')}`,
      );
      expect(stdout.match(/Rule allows open egress/g)).toHaveLength(1);
      expect(stdout).toContain(
        `File:    ${path.join('nested_var_deref', 'sg_open_ssh.tf')}`,
      );
      expect(exitCode).toBe(1);
    });

    it('scans a mix of IaC files in nested directories', async () => {
      const { stdout, exitCode } = await run(`snyk iac test ./iac`);

      expect(stdout).toContain(
        `File:    ${path.join('kubernetes', 'pod-privileged.yaml')}`,
      );

      expect(stdout).toContain(
        `File:    ${path.join('terraform', 'var_deref', 'sg_open_ssh.tf')}`,
      );
      expect(stdout.match(/Security Group allows open ingress/g)).toHaveLength(
        9,
      );
      expect(stdout).toContain(
        `File:    ${path.join('terraform', 'var_deref', 'sg_open_ssh.tf')}`,
      );

      expect(stdout).toContain(
        `File:    ${path.join(
          'terraform',
          'var_deref',
          'nested_var_deref',
          'sg_open_ssh.tf',
        )}`,
      );
      expect(stdout.match(/Rule allows open egress/g)).toHaveLength(1);
      expect(stdout).toContain(
        `File:    ${path.join(
          'terraform',
          'var_deref',
          'nested_var_deref',
          'sg_open_ssh.tf',
        )}`,
      );
      expect(exitCode).toBe(1);
    });
    it('filters out issues when using detection depth', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform/ --detection-depth=1`,
      );

      expect(stdout).toContain(
        `File:    ${path.join('var_deref', 'sg_open_ssh.tf')}`,
      );
      expect(stdout).toContain('File:    sg_open_ssh.tf');
      expect(stdout.match(/Security Group allows open ingress/g)).toHaveLength(
        6,
      );
      // Check that we didn't scan directories with depth > 2
      expect(stdout).not.toContain(
        path.join('var_deref', 'nested_var_deref', 'sg_open_ssh.tf'),
      );
      expect(stdout.match(/Rule allows open egress/g)).toBeNull();
      expect(stdout).not.toContain(
        path.join('var_deref', 'nested_var_deref', 'sg_open_ssh.tf'),
      );
      expect(exitCode).toBe(1);
    });
  });

  describe('with the --var-file flag', () => {
    it('picks up the file and dereferences the variable context for the right directory (pathToScan)', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform/var_deref/nested_var_deref --var-file=./iac/terraform/vars.tf`,
      );
      expect(stdout).toContain(
        '  Path:    input > resource > aws_security_group[allow_ssh_external_var_file] >' +
          EOL +
          '           ingress',
      );
      expect(stdout).toContain(
        'Files without issues: 2' + EOL + '✗ Files with issues: 1',
      );
      expect(exitCode).toBe(1);
    });
    it('returns error if the file does not exist', async () => {
      const path = './iac/terraform/non-existent.tfvars';
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform/var_deref --var-file=${path}`,
      );
      expect(stdout).toContainText(new InvalidVarFilePath(path).message);
      expect(exitCode).toBe(2);
    });
    it('will not parse the external file if it is invalid', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform/var_deref --var-file=./iac/terraform/sg_open_ssh_invalid_hcl2.tf`,
      );
      expect(stdout).toContain(
        'Failed to parse Terraform file' +
          EOL +
          '  Path: ./iac/terraform/sg_open_ssh_invalid_hcl2.tf',
      );
      expect(exitCode).toBe(1);
    });
  });
});
