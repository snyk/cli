import { startMockServer, isValidJSONString } from './helpers';

jest.setTimeout(50000);

describe('Terraform plan scanning', () => {
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

  it('finds issues in a Terraform plan file', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform-plan/tf-plan-create.json`,
    );
    expect(exitCode).toBe(1);

    expect(stdout).toContain(
      'Testing ./iac/terraform-plan/tf-plan-create.json',
    );
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain('✗ S3 bucket versioning disabled');
    expect(stdout).toContain(
      'resource > aws_s3_bucket[terra_ci] > versioning > enabled',
    );
  });

  it('finds issues in a Terraform plan file - explicit delta scan with flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform-plan/tf-plan-create.json --scan=resource-changes`,
    );

    expect(exitCode).toBe(1);
    expect(stdout).toContain('Infrastructure as code issues:');
    expect(stdout).toContain(
      'Tested ./iac/terraform-plan/tf-plan-create.json for known issues, found 3 issues',
    );
  });

  it('errors when a wrong value is passed to the --scan flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform-plan/tf-plan-create.json --scan=resrc-changes`,
    );

    expect(exitCode).toBe(2);
    expect(stdout).toContain(
      'Unsupported value "resrc-changes" provided to flag "--scan".',
    );
  });

  it('errors when no value is provided to the --scan flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform-plan/tf-plan-create.json.json  --scan`,
    );

    expect(exitCode).toBe(2);
    expect(stdout).toContain(
      'Unsupported value "true" provided to flag "--scan".',
    );
  });

  it('succesfully scans a TF-Plan with the --json output flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform-plan/tf-plan-create.json --json`,
    );

    expect(exitCode).toBe(1);
    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-TF-124",');
    expect(stdout).toContain('"packageManager": "terraformconfig",');
    expect(stdout).toContain('"projectType": "terraformconfig",');
  });
});
