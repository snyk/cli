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

    expect(stdout).toContain('Snyk is missing auth token in order to run inside CI');
    expect(stderr).toBe('');
  });
});
