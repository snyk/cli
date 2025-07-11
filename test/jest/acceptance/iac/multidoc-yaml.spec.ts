import { startMockServer } from './helpers';
import { MappedIacTestResponse } from '../../../../src/lib/snyk-test/iac-test-result';
import { FakeServer } from '../../../acceptance/fake-server';
jest.setTimeout(50000);

describe('iac test --json file.yaml', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => teardown());

  it('supports the correct line numbers for multi-doc YAML files', async () => {
    // Test a multidoc YAML file with one "high" issue in each subdoc.
    const { stdout } = await run(
      `snyk iac test --json --severity-threshold=high ./iac/kubernetes/pod-privileged-multi.yaml`,
    );

    const result: MappedIacTestResponse = JSON.parse(stdout);
    const issues = result.infrastructureAsCodeIssues;

    expect(issues.length).toBe(2);

    expect(issues[0].lineNumber).toBe(11);
    expect(issues[1].lineNumber).toBe(22);

    expect(issues[0].path[0]).toBe('[DocId: 0]');
    expect(issues[1].path[0]).toBe('[DocId: 1]');
  });
});

describe('iac test --json file.yaml for IaCV2', () => {
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

  it('supports the correct line numbers for multi-doc YAML files', async () => {
    // Test a multidoc YAML file with one "high" issue in each subdoc.
    const { stdout } = await run(
      `snyk iac test --json --severity-threshold=high ./iac/kubernetes/pod-privileged-multi.yaml`,
    );

    const result: MappedIacTestResponse = JSON.parse(stdout);
    const issues = result[0].infrastructureAsCodeIssues;

    expect(issues.length).toBe(2);

    expect(issues[0].lineNumber).toBe(2);
    expect(issues[1].lineNumber).toBe(13);
  });
});
