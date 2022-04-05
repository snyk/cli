import { startMockServer, isValidJSONString } from './helpers';

jest.setTimeout(50000);

describe('ARM single file scan', () => {
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

  it('finds issues in ARM JSON file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/rule_test.json`,
    );
    expect(stdout).toContain('Testing ./iac/arm/rule_test.json');
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain(
      '✗ Azure Firewall Network Rule Collection allows public access',
    );
    expect(stdout).toContain(
      'resources[1] > properties > networkRuleCollections[0] > properties > rules[0] > sourceAddresses',
    );
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/rule_test.json --severity-threshold=high`,
    );
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain(
      'Tested ./iac/arm/rule_test.json for known issues, found 0 issues',
    );
    expect(exitCode).toBe(0);
  });

  it('outputs an error for files with no valid JSON', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/invalid_rule_test.json`,
    );

    expect(stdout).toContain('We were unable to parse the JSON file');
    expect(exitCode).toBe(2);
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/rule_test.json --sarif`,
    );

    expect(stdout).toContain('"id": "SNYK-CC-TF-20",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-TF-20",');
    expect(exitCode).toBe(1);
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/rule_test.json --json`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-TF-20",');
    expect(stdout).toContain('"packageManager": "armconfig",');
    expect(stdout).toContain('"projectType": "armconfig",');
    expect(exitCode).toBe(1);
  });
});
