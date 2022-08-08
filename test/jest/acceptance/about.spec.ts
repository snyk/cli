import { runSnykCLI } from '../util/runSnykCLI';

describe('--about', () => {
  it('prints open source attribution information', async () => {
    const { code, stdout } = await runSnykCLI(`--about`);

    expect(code).toBe(0);
    expect(stdout).toContain('Snyk CLI Open Source Attributions');
    expect(stdout).toContain('MIT');
    expect(stdout).toContain('John-David Dalton'); // lodash author
  });
});
