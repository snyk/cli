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
    expect(exitCode).toBe(1);

    expect(stdout).toContain('Testing ./iac/cloudformation/aurora-valid.yml');
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain(
      '✗ SNS topic is not encrypted with customer managed key',
    );
    expect(stdout).toContain(
      '[DocId: 0] > Resources[DatabaseAlarmTopic] > Properties > KmsMasterKeyId',
    );
  });

  it('finds issues in CloudFormation JSON file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/fargate-valid.json`,
    );
    expect(exitCode).toBe(1);

    expect(stdout).toContain('Testing ./iac/cloudformation/fargate-valid.json');
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain(
      '✗ S3 restrict public bucket control is disabled',
    );
    expect(stdout).toContain(
      'Resources[CodePipelineArtifactBucket] > Properties > PublicAccessBlockConfiguration > RestrictPublicBuckets',
    );
  });

  it('filters out issues when using severity threshold', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml --severity-threshold=high`,
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain(
      'Tested ./iac/cloudformation/aurora-valid.yml for known issues, found 0 issues',
    );
  });

  it('outputs an error for files with no valid YAML', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/invalid-cfn.yml`,
    );

    expect(exitCode).toBe(2);
    expect(stdout).toContain('We were unable to parse the YAML file "./iac/cloudformation/invalid-cfn.yml". Please ensure that it contains properly structured YAML, without any template directives');
  });

  it('outputs the expected text when running with --sarif flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml --sarif`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('"id": "SNYK-CC-TF-55",');
    expect(stdout).toContain('"ruleId": "SNYK-CC-TF-55",');
  });

  it('outputs the expected text when running with --json flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/cloudformation/aurora-valid.yml --json`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('"id": "SNYK-CC-TF-55",');
    expect(stdout).toContain('"packageManager": "cloudformationconfig",');
    expect(stdout).toContain('"projectType": "cloudformationconfig",');
  });
});
