import { runSnykCLI } from '../../util/runSnykCLI';
import { describeIf, isWindowsOperatingSystem } from '../../../utils';

jest.setTimeout(1000 * 300);

/**
 * This adds a new `baseRuntimes` fact to scan results containing Java version information.
 */
describe('snyk container - JVM release file detection (CN-444)', () => {
  const isWindows = isWindowsOperatingSystem();
  const TEST_FIXTURE = 'test/fixtures/container-projects/jvm-release-test.tar';

  describeIf(!isWindows)('test', () => {
    it('detects Java version from images with JVM release files', async () => {
      const { code, stdout } = await runSnykCLI(
        `container monitor ${TEST_FIXTURE} --json`,
      );

      expect(code).toEqual(0);

      const jsonOutput = JSON.parse(stdout);
      expect(jsonOutput).toBeDefined();
      expect(jsonOutput.scanResult).toBeDefined();

      const baseRuntimesFact = jsonOutput.scanResult.facts?.find(
        (fact: any) => fact.type === 'baseRuntimes',
      );
      expect(baseRuntimesFact).toBeDefined();

      expect(baseRuntimesFact.data).toBeDefined();
      expect(Array.isArray(baseRuntimesFact.data)).toBe(true);
      expect(baseRuntimesFact.data.length).toBeGreaterThan(0);

      const javaRuntime = baseRuntimesFact.data.find(
        (runtime: any) => runtime.type === 'java',
      );
      expect(javaRuntime).toBeDefined();
      expect(javaRuntime.version).toMatch(/^11\./);
    }, 180000);
  });
});
