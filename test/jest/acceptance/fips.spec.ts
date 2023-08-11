import { runSnykCLI } from '../util/runSnykCLI';
import * as fips from '../util/fipsTestHelper';

jest.setTimeout(1000 * 10);

describe('FIPS', () => {
  if (!fips.fipsTestsEnabled()) {
    it('Tests are disabled!', async () => {
      console.warn('FIPS Tests are disabled.');
    });
  } else {
    const fipsEnabled = fips.getFipsEnabledEnvironment();
    const fipsDisabled = fips.getFipsDisabledEnvironment();

    it('panic when FIPS is not enabled in the environment', async () => {
      const result = await runSnykCLI('whoami --experimental -d', {
        env: fipsDisabled,
      });
      if (result.code != 2) {
        console.debug(result.stderr);
        console.debug(result.stdout);
      }
      expect(result.code).toBe(2);
    });

    if (Object.keys(fipsEnabled).length != 0) {
      it('do not panic when FIPS is enabled in the environment', async () => {
        const result = await runSnykCLI('whoami --experimental -d', {
          env: fipsEnabled,
        });
        if (result.code != 0) {
          console.debug(result.stderr);
        }
        expect(result.code).toBe(0);
      });
    }
  }
});
