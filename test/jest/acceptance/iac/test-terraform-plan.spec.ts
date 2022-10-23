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

    expect(stdout).toContain(
      'File:    ./iac/terraform-plan/tf-plan-create.json',
    );
    expect(stdout).toContain('S3 bucket versioning disabled');
    expect(stdout).toContain(
      'resource > aws_s3_bucket[terra_ci] > versioning > enabled',
    );
    expect(exitCode).toBe(1);
  });

  it('finds issues in a Terraform plan file - explicit delta scan with flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform-plan/tf-plan-create.json --scan=resource-changes`,
    );

    expect(stdout).toContain('Files with issues: 1');
    expect(exitCode).toBe(1);
  });

  it('errors when a wrong value is passed to the --scan flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform-plan/tf-plan-create.json --scan=resrc-changes`,
    );
    expect(stdout).toContain(
      'Unsupported value "resrc-changes" provided to flag "--scan".',
    );
    expect(exitCode).toBe(2);
  });

  it('errors when no value is provided to the --scan flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform-plan/tf-plan-create.json.json  --scan`,
    );
    expect(stdout).toContain(
      'Unsupported value "true" provided to flag "--scan".',
    );
    expect(exitCode).toBe(2);
  });

  it('successfully scans a TF-Plan with the --json output flag', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/terraform-plan/tf-plan-create.json --json`,
    );

    expect(isValidJSONString(stdout)).toBe(true);
    expect(stdout).toContain('"id": "SNYK-CC-TF-124",');
    expect(stdout).toContain('"packageManager": "terraformconfig",');
    expect(stdout).toContain('"projectType": "terraformconfig",');
    expect(exitCode).toBe(1);
  });
});
