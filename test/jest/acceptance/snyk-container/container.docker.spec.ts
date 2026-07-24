import { exec } from 'child_process';
import { promisify } from 'util';
import { runSnykCLI } from '../../util/runSnykCLI';

const execAsync = promisify(exec);

jest.setTimeout(1000 * 300);

describe('snyk container with a local Docker daemon', () => {
  it('successfully scans a local docker image with private tag', async () => {
    const tarPath = 'test/fixtures/container-projects/node-slim-image.tar';
    const privateTag = 'private-registry.local/test-node-slim:latest';

    try {
      const loadResult = await execAsync(`docker load -i ${tarPath}`);

      const loadOutput = loadResult.stdout || loadResult.stderr;
      const imageMatch = loadOutput.match(/Loaded image.*?:\s*(.+)/);

      if (!imageMatch) {
        throw new Error(
          `Could not extract image name from docker load output: ${loadOutput}`,
        );
      }

      const loadedImageName = imageMatch[1].trim();

      await execAsync(`docker tag ${loadedImageName} ${privateTag}`);

      const { code, stdout } = await runSnykCLI(
        `container test ${privateTag} --json`,
      );

      // Exit code 1 means vulnerabilities were found and is valid here.
      expect([0, 1]).toContain(code);

      let jsonOutput;
      try {
        jsonOutput = JSON.parse(stdout);
      } catch (error) {
        throw new Error(`Failed to parse JSON output: ${error.message}.`);
      }

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput.packageManager).toBeDefined();
      expect(jsonOutput.applications).toBeDefined();
      expect(jsonOutput.applications).toHaveLength(3);
    } finally {
      try {
        await execAsync(`docker rmi ${privateTag}`);
      } catch (cleanupError) {
        console.warn(
          `Failed to cleanup image ${privateTag}:`,
          cleanupError.message,
        );
      }
    }
  });

  it('successfully scans container with an executable file larger than the node.js max file size', async () => {
    const dockerfilePath =
      'test/fixtures/container-projects/Dockerfile-large-elf-vulns';
    const testImageName = 'snyk-test-large-elf:latest';

    try {
      console.log('Building test image with large ELF file...');
      const buildResult = await execAsync(
        `docker build -f ${dockerfilePath} -t ${testImageName} test/fixtures/container-projects/`,
      );

      console.log('Docker build completed:', buildResult.stdout);
      console.log('Running snyk container test...');
      const { code, stdout, stderr } = await runSnykCLI(
        `container test ${testImageName} --json`,
      );

      expect(code).toBe(1);

      let jsonOutput;
      try {
        jsonOutput = JSON.parse(stdout);
      } catch (error) {
        throw new Error(
          `Failed to parse JSON output: ${error.message}. Output: ${stdout}`,
        );
      }

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput.packageManager).toBeDefined();

      if (stderr && stderr.trim()) {
        throw new Error(`Unexpected errors during container scan:\n${stderr}`);
      }

      console.log('Container test completed successfully with large ELF file');
    } finally {
      try {
        await execAsync(`docker rmi ${testImageName}`);
        console.log('Cleaned up test image');
      } catch (cleanupError) {
        console.warn(
          `Failed to cleanup image ${testImageName}:`,
          cleanupError.message,
        );
      }
    }
  });
});
