import { describe, it, expect } from '@jest/globals';
import { runSnykCLI } from '../jest/util/runSnykCLI';

describe('Snyk CLI Authorization', () => {
  it('fails when run in CI without token set', async () => {
    const { stdout, stderr } = await runSnykCLI('auth --auth-type=token', {
      env: {
        ...process.env,
        CI: 'true',
      },
    });

    expect(stdout).toContain(
      'Snyk is missing auth token in order to run inside CI',
    );
    expect(stderr).toBe('');
  });

  it('fails if given bogus token', async () => {
    const { stdout, stderr } = await runSnykCLI(
      'auth 00000000-0000-0000-0000-000000000000',
    );
    expect(stdout).toContain(
      'Authentication failed. Please check the API token',
    );
    expect(stderr).toBe('');
  });

  it('updates config file if given legit token', async () => {
    const { stdout, stderr } = await runSnykCLI(
      `auth ${process.env.TEST_SNYK_TOKEN}`,
    );
    expect(stdout).toContain(
      'Your account has been authenticated. Snyk is now ready to be used.',
    );
    expect(stderr).toBe('');

    const { stdout: cfgStdout, stderr: cfgStderr } =
      await runSnykCLI('config get api');
    expect(cfgStdout).toContain(process.env.TEST_SNYK_TOKEN);
    expect(cfgStderr).toBe('');
  });
});
