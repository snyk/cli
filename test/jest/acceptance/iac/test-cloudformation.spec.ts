import { EOL } from 'os';
import { startMockServer, isValidJSONString } from './helpers';
import { InvalidYamlFileError } from '../../../../src/cli/commands/test/iac/local-execution/yaml-parser';
import { FakeServer } from '../../../acceptance/fake-server';
import { getErrorUserMessage } from '../../../../src/lib/iac/test/v2/errors';

jest.setTimeout(50000);

describe('CloudFormation single file scan', () => {
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

  it('finds issues in CloudFormation YAML file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml`,
    );
    expect(stdout).toContain('File:    ./iac/cloudformation/aurora-valid.yml');
    expect(stdout).toContain(
      'SNS topic is not encrypted with customer managed key',
    );
    expect(stdout).toContain(
      '  Path:    [DocId: 0] > Resources[DatabaseAlarmTopic] > Properties >' +
        EOL +
        '           KmsMasterKeyId',
    );
    expect(exitCode).toBe(1);
  });

  it('finds issues in CloudFormation JSON file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/fargate-valid.json`,
    );
    expect(stdout).toContain(
      'File:    ./iac/cloudformation/fargate-valid.json',
    );
    expect(stdout).toContain('SNYK-CC-TF-124');
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml --severity-threshold=high`,
    );

    expect(stdout).toContain('No vulnerable paths were found!');
    expect(exitCode).toBe(0);
  });

  it('outputs an error for files with no valid YAML', async () => {
    const path = ' ./iac/cloudformation/invalid-cfn.yml';
    const { stdout, exitCode } = await run(`snyk iac test ${path}`);

    expect(stdout).toContainText(new InvalidYamlFileError(path).message);
    expect(exitCode).toBe(2);
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml --sarif`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-TF-55",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-TF-55",');
    expect(exitCode).toBe(1);
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml --json`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-TF-55",');
    expect(stdout).toContain('"packageManager": "cloudformationconfig",');
    expect(stdout).toContain('"projectType": "cloudformationconfig",');
    expect(exitCode).toBe(1);
  });
});

describe('CloudFormation single file scan for IaCV2', () => {
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

  it('finds issues in CloudFormation YAML file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml`,
    );
    expect(stdout).toContain('File:    iac/cloudformation/aurora-valid.yml');
    expect(stdout).toContain('RDS instance is not using encrypted storage');
    expect(stdout).toContain(
      '  Path:    resource > AuroraInstance0 > StorageEncrypted',
    );
    expect(exitCode).toBe(1);
  });

  it('finds issues in CloudFormation JSON file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/fargate-valid.json`,
    );
    expect(stdout).toContain('File:    iac/cloudformation/fargate-valid.json');
    expect(stdout).toContain('SNYK-CC-00021');
    expect(exitCode).toBe(1);
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml --severity-threshold=high`,
    );

    expect(stdout).toContain('No vulnerable paths were found!');
    expect(exitCode).toBe(0);
  });

  it('outputs an error for files with no valid YAML', async () => {
    const path = ' ./iac/cloudformation/invalid-cfn.yml';
    const { stdout, exitCode } = await run(`snyk iac test ${path}`);
    const error = getErrorUserMessage(2105, 'FailedToParseInput');

    expect(stdout).toContainText(error);
    expect(exitCode).toBe(2);
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml --sarif`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-00002",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-00002",');
    expect(exitCode).toBe(1);
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml --json`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-00002",');
    expect(stdout).toContain('"packageManager": "cloudformationconfig",');
    expect(stdout).toContain('"projectType": "cloudformationconfig",');
    expect(exitCode).toBe(1);
  });
});
