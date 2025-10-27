import * as os from 'os';
import { startSnykCLI, TestCLI } from '../../util/startSnykCLI';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk container - chisel images', () => {
  // Skip on Windows - chisel images are Linux-only
  if (os.platform().startsWith('win')) {
    // eslint-disable-next-line jest/no-focused-tests
    it.only('Windows not yet supported', () => {
      console.warn(
        "Skipping chisel tests - chisel images aren't available for Windows.",
      );
    });
  }

  const CHISEL_IMAGE = 'ubuntu/dotnet-runtime:6.0-22.04_stable';

  let cli: TestCLI | null = null;

  afterEach(async () => {
    if (cli) {
      await cli.stop();
      cli = null;
    }
    jest.resetAllMocks();
  });

  describe('test', () => {
    it('finds dependencies in chisel images', async () => {
      const { code, stdout } = await runSnykCLI(
        `container test ${CHISEL_IMAGE} --json`,
      );
      const jsonOutput = JSON.parse(stdout);

      // Exit code can be 0 (no vulns) or 1 (vulns found), both are valid
      expect([0, 1]).toContain(code);
      expect(jsonOutput.dependencyCount).toBeGreaterThan(0);
    }, 60000);

    it('correctly identifies OS for chisel images with release info', async () => {
      const { code, stdout } = await runSnykCLI(
        `container test ${CHISEL_IMAGE} --json`,
      );
      const jsonOutput = JSON.parse(stdout);

      expect([0, 1]).toContain(code);
      expect(jsonOutput.docker).toBeDefined();
      expect(jsonOutput.docker.os).toBeDefined();
      expect(jsonOutput.docker.os.prettyName).toBeDefined();
      // Should identify as Ubuntu, not as "chisel" when release info is present
      expect(jsonOutput.docker.os.prettyName).toContain('Ubuntu');
      expect(jsonOutput.packageManager).toBe('deb');
    }, 60000);

    it('produces valid JSON output structure for chisel images', async () => {
      const { code, stdout } = await runSnykCLI(
        `container test ${CHISEL_IMAGE} --json`,
      );

      expect([0, 1]).toContain(code);

      let jsonOutput;
      expect(() => {
        jsonOutput = JSON.parse(stdout);
      }).not.toThrow();

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput.packageManager).toBe('deb');
      expect(jsonOutput.dependencyCount).toBeDefined();
      expect(typeof jsonOutput.dependencyCount).toBe('number');
    }, 60000);

    it('prints dependencies with --print-deps flag', async () => {
      cli = await startSnykCLI(`container test ${CHISEL_IMAGE} --print-deps`);

      // Chisel images contain base-files package
      await expect(cli).toDisplay('base-files', { timeout: 60 * 1000 });
    });
  });
});
