import { runSnykCLI } from '../util/runSnykCLI';
import { isWindowsOperatingSystem, describeIf } from '../../utils';
import { EXIT_CODES } from '../../../src/cli/exit-codes';

jest.setTimeout(1000 * 60);

const notWindows = !isWindowsOperatingSystem();

// Address as part CLI-1207
describeIf(notWindows)('exit code behaviour - legacycli', () => {
  it.each([
    { input: 0, expected: 0 },
    { input: 1, expected: 1 },
    { input: 2, expected: 2 },
    { input: 3, expected: 3 },
    { input: -1, expected: 2 },
  ])(
    'map legacy cli exit code $input to $expected',
    async ({ input, expected }) => {
      const { code } = await runSnykCLI(
        `woof --exit-code=${input} --language=cat -d`,
      );
      expect(code).toEqual(expected);
    },
  );
});

describe('exit code behaviour - general', () => {
  it('Correct exit code when snyk_timeout_secs expires', async () => {
    const testEnv = {
      ...process.env,
      SNYK_TIMEOUT_SECS: '1',
    };

    const { code } = await runSnykCLI(`test --all-projects -d`, {
      env: testEnv,
    });

    expect(code).toEqual(EXIT_CODES.EX_UNAVAILABLE);
  });
});
