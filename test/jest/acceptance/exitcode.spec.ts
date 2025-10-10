import { runSnykCLI } from '../util/runSnykCLI';
import { isWindowsOperatingSystem } from '../../utils';

jest.setTimeout(1000 * 60);

// Address as part CLI-1207
describe('exit code behaviour', () => {
  if (!isWindowsOperatingSystem()) {
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
  } else {
    it('skipped on windows OS', () => {
      expect(true).toBe(true);
    });
  }
});
