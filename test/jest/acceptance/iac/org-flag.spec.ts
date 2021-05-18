import { startMockServer, run as Run } from './helpers';

describe('iac test --org', () => {
  let run: typeof Run;
  let teardown: () => void;

  beforeAll(async () => {
    const result = await startMockServer();
    run = result.run;
    teardown = result.teardown;
  });

  afterAll(async () => teardown());

  it('uses the default org', async () => {
    const { stdout } = await run(
      `snyk iac test --json ./iac/terraform/sg_open_ssh.tf`,
    );
    const result = JSON.parse(stdout);
    expect(result.meta.org).toBe('test-org');
  });

  it('uses the the org provided via the --org flag', async () => {
    const { stdout } = await run(
      `snyk iac test --org=custom-org --json ./iac/terraform/sg_open_ssh.tf`,
    );
    const result = JSON.parse(stdout);
    expect(result.meta.org).toBe('custom-org');
  });

  it('uses the the org provided via the SNYK_CFG_ORG variable', async () => {
    const { stdout } = await run(
      `snyk iac test --json ./iac/terraform/sg_open_ssh.tf`,
      {
        SNYK_CFG_ORG: 'custom-org',
      },
    );
    const result = JSON.parse(stdout);
    expect(result.meta.org).toBe('custom-org');
  });
});
