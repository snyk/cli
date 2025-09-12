import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 120);

describe('Language Server Extension', () => {
  it('get ls licenses', async () => {
    const result = await runSnykCLI('language-server --licenses -d');
    if (result.code != 0) {
      console.debug(result.stderr);
      console.debug(result.stdout);
    }
    expect(result.code).toBe(0);
  });

  it('get ls version', async () => {
    const cliResult = await runSnykCLI('-v');
    const result = await runSnykCLI('language-server -v -d');
    if (result.code != 0) {
      console.debug(result.stderr);
      console.debug(result.stdout);
    }
    expect(result.code).toBe(0);
    expect(cliResult.code).toBe(0);
    expect(result.stdout).not.toEqual(cliResult.stdout);
  });
});
