import { startMockServer, isValidJSONString } from './helpers';

jest.setTimeout(50000);

describe('Kubernetes single file scan', () => {
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

  it('finds issues in Kubernetes JSON file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml`,
    );
    expect(exitCode).toBe(1);

    expect(stdout).toContain('Testing ./iac/kubernetes/pod-privileged.yaml');
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain('✗ Privileged container');
    expect(stdout).toContain(
      '[DocId: 0] > input > spec > containers[example] > securityContext > privileged',
    );
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml --severity-threshold=high`,
    );

    expect(exitCode).toBe(1);
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain(
      'Tested ./iac/kubernetes/pod-privileged.yaml for known issues, found 1 issues',
    );
  });

  it('outputs an error for files with no valid YAML', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-invalid.yaml`,
    );

    expect(exitCode).toBe(3);
    expect(stdout).toContain(
      'Could not find any valid infrastructure as code files. Supported file extensions are tf, yml, yaml & json.',
    );
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml --sarif`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('"id": "SNYK-CC-K8S-42",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-K8S-42",');
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml --json`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('"id": "SNYK-CC-K8S-42",');
    expect(stdout).toContain('"packageManager": "k8sconfig",');
    expect(stdout).toContain('"projectType": "k8sconfig",');
  });

  it('outputs an error for Helm files', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/helm-config.yaml`,
    );

    expect(exitCode).toBe(2);
    expect(stdout).toContain(
      'We were unable to parse the YAML file "./iac/kubernetes/helm-config.yaml". Please ensure that it contains properly structured YAML, without any template directives',
    );
  });
});
