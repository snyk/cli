import { runSnykCLI } from '../../util/runSnykCLI';
import {
  getCliConfig,
  restoreCliConfig,
} from '../../../acceptance/config-helper';

jest.setTimeout(1000 * 30);

describe('snyk config environment', () => {
  let initialConfig: Record<string, string> = {};
  const env = { ...process.env };

  beforeAll(async () => {
    initialConfig = await getCliConfig();
    delete env.SNYK_TOKEN;
    delete env.SNYK_API;
    delete env.SNYK_CFG_ORG;
  });

  afterAll(async () => {
    await restoreCliConfig(initialConfig);
  });

  beforeEach(async () => {
    await runSnykCLI(`config clear`); // start from a clean state
  });

  it('successfully configure with a partial DNS name', async () => {
    const { code, stderr } = await runSnykCLI(`config environment dev`, {
      env: env,
    });
    expect(stderr).toEqual('');
    expect(code).toEqual(0);

    const { stdout } = await runSnykCLI(`config get endpoint`);
    expect(stdout.trim()).toEqual('https://api.dev.snyk.io');
  });

  it('successfully configure with a URL', async () => {
    const { code, stderr } = await runSnykCLI(
      `config environment https://api.dev.snyk.io`,
      {
        env: env,
      },
    );
    expect(stderr).toEqual('');
    expect(code).toEqual(0);

    const { stdout } = await runSnykCLI(`config get endpoint`);
    expect(stdout.trim()).toEqual('https://api.dev.snyk.io');
  });

  it('fail with an invalid env alias', async () => {
    const { code, stderr } = await runSnykCLI(
      `config environment randomEnvName`,
      { env: env },
    );
    expect(stderr).toEqual('');
    expect(code).toEqual(2);
  });

  it('fail with env var collision', async () => {
    const { code, stderr } = await runSnykCLI(`config environment eu`, {
      env: { ...env, SNYK_TOKEN: 'https://api.snyk.io' },
    });
    expect(stderr).toEqual('');
    expect(code).toEqual(2);
  });

  it('successfully configure by ignoring env var collisions', async () => {
    const { code, stderr } = await runSnykCLI(
      `config environment eu --no-check`,
      {
        env: { ...env, SNYK_TOKEN: 'https://api.snyk.io' },
      },
    );
    expect(stderr).toEqual('');
    expect(code).toEqual(0);
  });
});
