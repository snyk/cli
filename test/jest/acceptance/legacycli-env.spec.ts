import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

describe('cli env', () => {
  it('should run the command with the correct env', async () => {
    const { stdout } = await runSnykCLI(
      `-d woof --language=cat --env=SNYK_TMP_PATH`,
      {},
    );

    expect(stdout).not.toContain('SNYK_TMP_PATH=undefined');
  });
});
