import { startMockServer, isValidJSONString } from './helpers';

jest.setTimeout(50000);

describe('Directory scan', () => {
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

  it('scans all files in a directory with Kubernetes files', async () => {
    const { stdout, exitCode } = await run(`snyk iac test ./iac/kubernetes/`);
    expect(stdout).toContain('Testing pod-privileged.yaml'); //directory scan shows relative path to cwd in output
    expect(stdout).toContain('Testing pod-privileged-multi.yaml');
    expect(stdout).toContain('Testing pod-valid.json');
    expect(stdout).toContain('Testing helm-config.yaml');
    expect(stdout).toContain('Failed to parse YAML file');
    expect(stdout).toContain(
      'Tested 3 projects, 3 contained issues. Failed to test 1 project.',
    );
    expect(exitCode).toBe(1);
  });

  it('scans all files in a directory with a mix of IaC files', async () => {
    const { stdout, exitCode } = await run(`snyk iac test ./iac/`);
    //directory scan shows relative path to cwd  in output
    // here we assert just on the filename to avoid the different slashes (/) for Unix/Windows on the CI runner
    expect(stdout).toContain('pod-privileged.yaml');
    expect(stdout).toContain('pod-privileged-multi.yaml');
    expect(stdout).toContain('rule_test.json');
    expect(stdout).toContain('aurora-valid.yml');
    expect(stdout).toContain('fargate-valid.json');
    expect(stdout).toContain('root.tf');
    expect(stdout).toContain('one.tf');
    expect(stdout).toContain('tf-plan-update.json');
    expect(stdout).toContain('Failed to parse Terraform file');
    expect(stdout).toContain('Failed to parse YAML file');
    expect(stdout).toContain('Failed to parse JSON file');
    expect(stdout).toContain(
      '28 projects, 20 contained issues. Failed to test 5 projects.',
    );
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform --severity-threshold=high`,
    );
    expect(exitCode).toBe(0);
    //directory scan shows relative path to cwd  in output
    expect(stdout).toContain('Testing sg_open_ssh.tf');
    expect(stdout).toContain('Testing sg_open_ssh_invalid_hcl2.tf');
    expect(stdout).toContain('Testing sg_open_ssh_invalid_hcl2.tf');
    expect(stdout).toContain('Failed to parse Terraform file');
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform --sarif`,
    );
    expect(exitCode).toBe(1);
    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-TF-1",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-TF-1",');
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform --json`,
    );
    expect(exitCode).toBe(1);
    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-TF-1",');
    expect(stdout).toContain('"packageManager": "terraformconfig",');
  });

  it('limits the depth of the directories', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/depth_detection/  --detection-depth=2`,
    );
    expect(exitCode).toBe(1);

    // The CLI shows the output relative to the path: one/one.tf.
    // here we assert just on the filename to avoid the different slashes (/) for Unix/Windows on the CI runner
    expect(stdout).toContain('one.tf');
    expect(stdout).toContain('Infrastructure as code issues');
    expect(stdout).toContain('Testing root.tf');
    expect(stdout).toContain('Tested 2 projects');
    expect(stdout).not.toContain('two.tf');
  });

  describe('Variadic - multiple path scans', () => {
    it('outputs both results and failures combined when scanning two paths', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/terraform ./iac/cloudformation`,
      );
      //directory scan shows relative path to cwd  in output
      expect(stdout).toContain('Testing sg_open_ssh.tf');
      //TODO: currently the failures show only for the second path->cloudformation so this will fail:
      // expect(stdout).toContain('Testing sg_open_ssh_invalid_hcl2.tf');
      // expect(stdout).toContain('Failed to parse Terraform file');
      expect(stdout).toContain('Testing aurora-valid.yml');
      expect(stdout).toContain('Testing invalid-cfn.yml');
      expect(stdout).toContain('Failed to parse YAML file');
      expect(exitCode).toBe(1);
    });

    //TODO: this test fails until we fix the bug:
    // if one of the two paths fail due to not finding valid IaC files,
    // then it will override the valid results of the first scan
    it.skip('outputs both results and failures for first path when the last path is empty or non-existent', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm non-existing-dir`,
      );
      //directory scan shows relative path to cwd  in output
      expect(stdout).toContain('Testing rule_test.json.');
      expect(stdout).toContain('Testing invalid_rule_test.json.');
      expect(stdout).toContain('Failed to parse JSON file');
      expect(stdout).toContain('Failed to parse Terraform file');
      expect(exitCode).toBe(1);
    });
  });

  describe('Exit codes', () => {
    describe('Issues found', () => {
      it('returns 1 even if some files failed to parse', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/kubernetes/`,
        );
        expect(stderr).toBe('');
        expect(stdout).toContain(
          'Tested 3 projects, 3 contained issues. Failed to test 1 project',
        );
        expect(exitCode).toBe(1);
      });
      it('returns 1 even if some files failed to parse - using --json flag', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/kubernetes/  --json`,
        );
        expect(stderr).toBe('');
        expect(stdout).toContain('"ok": false');
        expect(exitCode).toBe(1);
      });
    });

    describe('No Issues found', () => {
      it('returns 0 even if some files failed to parse', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/no_vulnerabilities/  --severity-threshold=high`,
        );
        expect(stderr).toBe('');
        expect(stdout).toContain('found 0 issues');
        expect(exitCode).toBe(0);
      });
      it('returns 0 even if some files failed to parse - using --json flag', async () => {
        const { exitCode, stderr, stdout } = await run(
          `snyk iac test ./iac/no_vulnerabilities/  --severity-threshold=high  --json`,
        );
        expect(stderr).toBe('');
        expect(stdout).toContain('"ok": true');
        expect(exitCode).toBe(0);
      });
    });
  });
});
