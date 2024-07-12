import { runSnykCLI } from '../../util/runSnykCLI';
import {
  getCliConfig,
  restoreCliConfig,
} from '../../../acceptance/config-helper';

jest.setTimeout(1000 * 30);

describe('snyk config environment', () => {
  let initialConfig: Record<string, string> = {};

  beforeEach(async () => {
    initialConfig = await getCliConfig();
  });

  afterEach(async () => {
    await restoreCliConfig(initialConfig);
  });

  it('successfully configure with a partial DNS name', async () => {
    const { code, stderr } = await runSnykCLI(`config environment dev`);
    expect(stderr).toEqual('');
    expect(code).toEqual(0);

    const { stdout } = await runSnykCLI(`config get endpoint`);
    expect(stdout.trim()).toEqual('https://api.dev.snyk.io');
  });

  it('successfully configure with a URL', async () => {
    const { code, stderr } = await runSnykCLI(
      `config environment https://api.dev.snyk.io`,
    );
    expect(stderr).toEqual('');
    expect(code).toEqual(0);

    const { stdout } = await runSnykCLI(`config get endpoint`);
    expect(stdout.trim()).toEqual('https://api.dev.snyk.io');
  });

  it('fail with an invalid env alias', async () => {
    const { code, stderr } = await runSnykCLI(
      `config environment randomEnvName`,
    );
    expect(stderr).toEqual('');
    expect(code).toEqual(2);
  });
});
