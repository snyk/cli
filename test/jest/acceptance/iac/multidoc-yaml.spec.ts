import { startMockServer } from './helpers';
import { MappedIacTestResponse } from '../../../../src/lib/snyk-test/iac-test-result';
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
