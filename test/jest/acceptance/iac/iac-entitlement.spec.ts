import { startMockServer, run as Run } from './helpers';

jest.setTimeout(50000);

describe('iac test with infrastructureAsCode entitlement', () => {
  let run: typeof Run;
  let teardown: () => void;

  beforeAll(async () => {
    const result = await startMockServer();
    run = result.run;
    teardown = result.teardown;
  });

  afterAll(async () => teardown());

  it('fails to scan because the user is not entitled to infrastructureAsCode', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --org=no-iac-entitlements ./iac/terraform/sg_open_ssh.tf`,
    );
    expect(exitCode).toBe(2);
    expect(stdout).toContain(
      'This feature is currently not enabled for your org. To enable it, please contact snyk support.',
    );
  });
});
