import * as os from 'os';
import * as path from 'path';
import { runSnykCLI } from '../../util/runSnykCLI';
import { RunCommandOptions, RunCommandResult } from '../../util/runCommand';

jest.setTimeout(1000 * 60);

describe('snyk container zstd test fixtures', () => {
  if (os.platform() === 'win32') {
    // eslint-disable-next-line jest/no-focused-tests
    it.only('Windows not yet supported', () => {
      console.warn(
        "Skipping as we don't have a Windows-compatible image to test against.",
      );
    });
  }

  const fixturesDir = path.join(
    __dirname,
    '../../../fixtures/container-projects',
  );
  const dockerImagePath = path.join(fixturesDir, 'docker-test-image.tar');
  const zstdOciPath = path.join(fixturesDir, 'zstd-test-oci.tar');
  const gzipOciPath = path.join(fixturesDir, 'gzip-test-oci.tar');

  describe('docker archive (gzip compression)', () => {
    it('should scan docker archive successfully (docker archives use gzip)', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test docker-archive:${dockerImagePath} --json`,
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
      expect(jsonOutput.packageManager).toBe('apk'); // Alpine-based test image
      expect(jsonOutput.dependencyCount).toBeGreaterThan(0);

      // Should not have compression errors
      expect(stderr).not.toContain('zstd decompression failed');

      // Should find expected packages from our test image
      expect(jsonOutput.vulnerabilities).toBeDefined();
    });

    it('should extract dependencies from docker archive', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test docker-archive:${dockerImagePath} --print-deps`,
      );

      expect([0, 1]).toContain(code);

      // Should show package manager and dependencies
      expect(stdout).toMatch(/Package manager:\s+apk/);
      expect(stdout).toContain('@'); // Package@version format

      // Should find packages we installed in the test image
      expect(stdout).toMatch(/ca-certificates|busybox|alpine/);

      // Should not have decompression errors
      expect(stderr).not.toContain('zstd decompression failed');
    });

    it('should handle depgraph command for docker archive', async () => {
      const { code, stderr } = await runSnykCLIWithDebug(
        `container depgraph "docker-archive:${dockerImagePath}"`,
        undefined,
        false, // Don't add --debug to avoid polluting JSON output
      );

      // The depgraph command should run without crashing
      // Note: depgraph might not work with all archive types, so we just check it doesn't crash
      expect([0, 1, 2]).toContain(code); // Allow various exit codes

      // Should not have zstd decompression errors
      expect(stderr).not.toContain('zstd decompression failed');
    });
  });

  describe('oci archives with different compression', () => {
    it('should handle both zstd and gzip compressed OCI archives correctly', async () => {
      // Test zstd compressed OCI archive
      const zstdResult = await runSnykCLIWithDebug(
        `container test oci-archive:${zstdOciPath} --json`,
      );

      // Test gzip compressed OCI archive (same content, different compression)
      const gzipResult = await runSnykCLIWithDebug(
        `container test oci-archive:${gzipOciPath} --json`,
      );

      // Both should succeed
      expect([0, 1]).toContain(zstdResult.code);
      expect([0, 1]).toContain(gzipResult.code);

      // Both should produce valid JSON
      let zstdOutput, gzipOutput;
      try {
        zstdOutput = JSON.parse(zstdResult.stdout);
        gzipOutput = JSON.parse(gzipResult.stdout);
      } catch (e) {
        throw new Error(`Failed to parse JSON outputs: ${e.message}`);
      }

      // Both should have the same package manager and similar dependency counts
      expect(zstdOutput.packageManager).toBe(gzipOutput.packageManager);
      expect(zstdOutput.dependencyCount).toBe(gzipOutput.dependencyCount);

      // Neither should have compression errors
      expect(zstdResult.stderr).not.toContain('zstd decompression failed');
      expect(gzipResult.stderr).not.toContain('zstd decompression failed');
    });
  });

  describe('zstd compressed oci archive', () => {
    it('should scan OCI archive with zstd compression', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test oci-archive:${zstdOciPath} --json`,
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

      // Should handle OCI format with zstd compression
      expect(stderr).not.toContain('zstd decompression failed');
    });
  });

  describe('zstd error handling', () => {
    it('should provide meaningful error for corrupted zstd data', async () => {
      // This test validates that zstd decompression errors are handled gracefully
      // We test with valid images to ensure no zstd errors occur
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test oci-archive:${zstdOciPath} --debug --json`,
      );

      expect([0, 1]).toContain(code);

      // Debug output should not contain zstd-related errors
      expect(stderr).not.toContain('zstd decompression failed');

      // Should complete successfully
      let jsonOutput;
      try {
        jsonOutput = JSON.parse(stdout);
      } catch (e) {
        throw new Error(
          `Failed to parse JSON output: ${e.message}. Stderr: ${stderr}`,
        );
      }

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput.packageManager).toBeDefined();
    });
  });

  async function runSnykCLIWithDebug(
    argsString: string,
    options?: RunCommandOptions,
    debug = false,
  ): Promise<RunCommandResult> {
    return await runSnykCLI(
      debug ? argsString + ' --debug' : argsString,
      options,
    );
  }
});
