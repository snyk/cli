import { EOL } from 'os';
import { startMockServer, isValidJSONString } from './helpers';
import { InvalidJsonFileError } from '../../../../src/cli/commands/test/iac/local-execution/yaml-parser';
import { FakeServer } from '../../../acceptance/fake-server';
import { getErrorUserMessage } from '../../../../src/lib/iac/test/v2/errors';

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
    expect(stdout).toContain(
      'Azure Firewall Network Rule Collection allows public access',
    );
    expect(stdout).toContain(
      '  Path:    resources[1] > properties > networkRuleCollections[0] > properties >' +
        EOL +
        '           rules[0] > sourceAddresses',
    );
    expect(stdout).toContain('File:    ./iac/arm/rule_test.json');
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/rule_test.json --severity-threshold=high`,
    );
    expect(stdout).toContain('No vulnerable paths were found!');
    expect(exitCode).toBe(0);
  });

  it('outputs an error for files with no valid JSON', async () => {
    const path = './iac/arm/invalid_rule_test.json';
    const { stdout, exitCode } = await run(`snyk iac test ${path}`);

    expect(stdout).toContainText(new InvalidJsonFileError(path).message);
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

describe('ARM single file scan for IaCV2', () => {
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

  it('finds issues in ARM JSON file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/rule_test.json`,
    );
    expect(stdout).toContain(
      'Firewall network rule collection allows public access',
    );
    expect(stdout).toContain(
      'Path:    resource > Microsoft[Network/azureFirewalls/denied] > properties >' +
        EOL +
        '           networkRuleCollections[0] > properties > action > type',
    );
    expect(stdout).toContain('File:    iac/arm/rule_test.json');
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/rule_test.json --severity-threshold=high`,
    );
    expect(stdout).toContain('No vulnerable paths were found!');
    expect(exitCode).toBe(0);
  });

  it('outputs an error for files with no valid JSON', async () => {
    const path = './iac/arm/invalid_rule_test.json';
    const { stdout, exitCode } = await run(`snyk iac test ${path}`);
    const error = getErrorUserMessage(2105, 'FailedToParseInput');

    expect(stdout).toContainText(error);
    expect(exitCode).toBe(2);
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/rule_test.json --sarif`,
    );

    expect(stdout).toContain('"id": "SNYK-CC-00477",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-00477",');
    expect(exitCode).toBe(1);
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/arm/rule_test.json --json`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-00477",');
    expect(stdout).toContain('"packageManager": "armconfig",');
    expect(stdout).toContain('"projectType": "armconfig",');
    expect(exitCode).toBe(1);
  });
});
