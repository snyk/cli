import { startMockServer, run as Run } from './helpers';
import { FakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(50000);

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

describe('iac test --org for IaCV2', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
    overrides?: Record<string, string>,
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

  it('uses the default org', async () => {
    const { stdout } = await run(
      `snyk iac test --json ./iac/terraform/sg_open_ssh.tf`,
    );
    const result = JSON.parse(stdout);
    expect(result[0].meta.org).toBe('test-org');
  });

  it('uses the the org provided via the --org flag', async () => {
    const { stdout } = await run(
      `snyk iac test --org=custom-org --json ./iac/terraform/sg_open_ssh.tf`,
    );
    const result = JSON.parse(stdout);
    expect(result[0].meta.org).toBe('custom-org');
  });

  it('uses the the org provided via the SNYK_CFG_ORG variable', async () => {
    const { stdout } = await run(
      `snyk iac test --json ./iac/terraform/sg_open_ssh.tf`,
      {
        SNYK_CFG_ORG: 'custom-org',
      },
    );
    const result = JSON.parse(stdout);
    expect(result[0].meta.org).toBe('custom-org');
  });
});
