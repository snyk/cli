import { EOL } from 'os';
import { startMockServer, isValidJSONString } from './helpers';
import { NoFilesToScanError } from '../../../../src/cli/commands/test/iac/local-execution/file-loader';
import { InvalidYamlFileError } from '../../../../src/cli/commands/test/iac/local-execution/yaml-parser';
import { FakeServer } from '../../../acceptance/fake-server';
import { getErrorUserMessage } from '../../../../src/lib/iac/test/v2/errors';

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

    expect(stdout).toContain(`File:    ./iac/kubernetes/pod-privileged.yaml`);
    expect(stdout).toContain('Privileged container');
    expect(stdout).toContain(
      '  Path:    [DocId: 0] > input > spec > containers[example] > securityContext >' +
        EOL +
        '           privileged',
    );
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml --severity-threshold=high`,
    );
    expect(stdout).toContain('File:    ./iac/kubernetes/pod-privileged.yaml');
    expect(stdout).toContain('Total issues: 1');
    expect(exitCode).toBe(1);
  });

  it('outputs an error for files with no valid YAML', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-invalid.yaml`,
    );
    expect(stdout).toContainText(new NoFilesToScanError().message);
    expect(exitCode).toBe(3);
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml --sarif`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-K8S-42",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-K8S-42",');
    expect(exitCode).toBe(1);
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml --json`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-K8S-42",');
    expect(stdout).toContain('"packageManager": "k8sconfig",');
    expect(stdout).toContain('"projectType": "k8sconfig",');
    expect(exitCode).toBe(1);
  });

  it('outputs an error for Helm files', async () => {
    const path = './iac/kubernetes/helm-config.yaml';
    const { stdout, exitCode } = await run(`snyk iac test ${path}`);
    expect(stdout).toContainText(new InvalidYamlFileError(path).message);
    expect(exitCode).toBe(2);
  });
});

describe('Kubernetes single file scan for IaCV2', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    const result = await startMockServer();
    server = result.server;
    run = result.run;
    teardown = result.teardown;
  });

  beforeEach(() => {
    server.setFeatureFlag('iacNewEngine', true);
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => teardown());

  it('finds issues in Kubernetes JSON file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml`,
    );

    expect(stdout).toContain(`File:    iac/kubernetes/pod-privileged.yaml`);
    expect(stdout).toContain('Container is running in privileged mode');
    expect(stdout).toContain(
      '  Path:    resource > example > example > spec > containers > example >' +
        EOL +
        '           securityContext > privileged',
    );
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml --severity-threshold=high`,
    );
    expect(stdout).toContain('File:    iac/kubernetes/pod-privileged.yaml');
    expect(stdout).toContain('Total issues: 1');
    expect(exitCode).toBe(1);
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml --sarif`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-00605",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-00605",');
    expect(exitCode).toBe(1);
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/kubernetes/pod-privileged.yaml --json`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-00608",');
    expect(stdout).toContain('"packageManager": "k8sconfig",');
    expect(stdout).toContain('"projectType": "k8sconfig",');
    expect(exitCode).toBe(1);
  });

  it('outputs an error for Helm files', async () => {
    const path = './iac/kubernetes/helm-config.yaml';
    const { stdout, exitCode } = await run(`snyk iac test ${path}`);
    const error = getErrorUserMessage(2105, 'FailedToParseInput');

    expect(stdout).toContainText(error);
    expect(exitCode).toBe(2);
  });
});
