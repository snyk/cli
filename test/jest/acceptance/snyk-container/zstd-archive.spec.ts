import * as os from 'os';
import { runSnykCLI } from '../../util/runSnykCLI';
import { RunCommandOptions, RunCommandResult } from '../../util/runCommand';

jest.setTimeout(1000 * 60);

describe('snyk container zstd archive edge cases', () => {
  if (os.platform() === 'win32') {
    // eslint-disable-next-line jest/no-focused-tests
    it.only('Windows not yet supported', () => {
      console.warn(
        "Skipping as we don't have a Windows-compatible image to test against.",
      );
    });
  }

  describe('archive format handling', () => {
    it('should handle zstd compressed OCI archive with auto-detection (no prefix)', async () => {
      // Test that zstd compressed OCI archives work with auto-detection
      const archivePath = 'test/fixtures/container-projects/zstd-test-oci.tar';

      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test ${archivePath} --json`,
      );

      expect([0, 1]).toContain(code);

      let jsonOutput;
      try {
        jsonOutput = JSON.parse(stdout);
      } catch (e) {
        throw new Error(
          `Failed to parse JSON output: ${e.message}. Stderr: ${stderr}`,
        );
      }

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput.packageManager).toBe('apk');

      // Should handle zstd decompression without errors
      expect(stderr).not.toContain('zstd decompression failed');
    });

    it('should handle zstd compressed OCI archive with explicit oci-archive prefix', async () => {
      // Test explicit OCI archive prefix (oci-archive: is a valid prefix per snyk-docker-plugin)
      const archivePath = 'test/fixtures/container-projects/zstd-test-oci.tar';

      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test oci-archive:${archivePath} --json`,
      );

      expect([0, 1]).toContain(code);

      let jsonOutput;
      try {
        jsonOutput = JSON.parse(stdout);
      } catch (e) {
        throw new Error(
          `Failed to parse JSON output: ${e.message}. Stderr: ${stderr}`,
        );
      }

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput.packageManager).toBe('apk');
      expect(jsonOutput.dependencyCount).toBeGreaterThan(0);

      // Should handle zstd decompression without errors
      expect(stderr).not.toContain('zstd decompression failed');
    });
  });

  async function runSnykCLIWithDebug(
    argsString: string,
    options?: RunCommandOptions,
    debug = true,
  ): Promise<RunCommandResult> {
    return await runSnykCLI(
      debug ? argsString + ' --debug' : argsString,
      options,
    );
  }
});
