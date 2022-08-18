import { EOL } from 'os';
import { startMockServer, isValidJSONString } from './helpers';

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
      '[DocId: 0] > Resources[DatabaseAlarmTopic] > Properties > KmsMasterKeyId',
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
    expect(stdout).toContain('S3 restrict public bucket control is disabled');
    expect(stdout).toContain(
      'Resources[CodePipelineArtifactBucket] > Properties > PublicAccessBlockConfiguration > RestrictPublicBuckets',
    );
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
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/invalid-cfn.yml`,
    );

    expect(stdout).toContain(
      'Failed to parse YAML file' +
        EOL +
        '  Path: ./iac/cloudformation/invalid-cfn.yml',
    );
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
