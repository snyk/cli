import * as os from 'os';
import { startSnykCLI, TestCLI } from '../../util/startSnykCLI';
import { runSnykCLI } from '../../util/runSnykCLI';
import { FakeServer, fakeServer } from '../../../acceptance/fake-server';
import { RunCommandOptions, RunCommandResult } from '../../util/runCommand';
import { getServerPort } from '../../util/getServerPort';
import { isWindowsOperatingSystem } from '../../../utils';

jest.setTimeout(1000 * 60);

describe('snyk container', () => {
  if (isWindowsOperatingSystem()) {
    // eslint-disable-next-line jest/no-focused-tests
    it.only('Windows not yet supported', () => {
      console.warn(
        "Skipping as we don't have a Windows-compatible image to test against.",
      );
    });
  }

  const TEST_DISTROLESS_STATIC_IMAGE =
    'gcr.io/distroless/static@sha256:7198a357ff3a8ef750b041324873960cf2153c11cc50abb9d8d5f8bb089f6b4e';
  const TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH = {
    schemaVersion: '1.3.0',
    pkgManager: {
      name: 'deb',
      repositories: [
        {
          alias: 'debian:11',
        },
      ],
    },
    pkgs: [
      {
        id: 'docker-image|gcr.io/distroless/static@',
        info: {
          name: 'docker-image|gcr.io/distroless/static',
        },
      },
      {
        id: 'base-files@11.1+deb11u7',
        info: {
          name: 'base-files',
          purl: 'pkg:deb/debian/base-files@11.1%2Bdeb11u7?distro=debian-bullseye',
          version: '11.1+deb11u7',
        },
      },
      {
        id: 'netbase@6.3',
        info: {
          name: 'netbase',
          purl: 'pkg:deb/debian/netbase@6.3?distro=debian-bullseye',
          version: '6.3',
        },
      },
      {
        id: 'tzdata@2021a-1+deb11u10',
        info: {
          name: 'tzdata',
          purl: 'pkg:deb/debian/tzdata@2021a-1%2Bdeb11u10?distro=debian-bullseye',
          version: '2021a-1+deb11u10',
        },
      },
    ],
    graph: {
      rootNodeId: 'root-node',
      nodes: [
        {
          nodeId: 'root-node',
          pkgId: 'docker-image|gcr.io/distroless/static@',
          deps: [
            {
              nodeId: 'base-files@11.1+deb11u7',
            },
            {
              nodeId: 'netbase@6.3',
            },
            {
              nodeId: 'tzdata@2021a-1+deb11u10',
            },
          ],
        },
        {
          nodeId: 'base-files@11.1+deb11u7',
          pkgId: 'base-files@11.1+deb11u7',
          deps: [],
        },
        {
          nodeId: 'netbase@6.3',
          pkgId: 'netbase@6.3',
          deps: [],
        },
        {
          nodeId: 'tzdata@2021a-1+deb11u10',
          pkgId: 'tzdata@2021a-1+deb11u10',
          deps: [],
        },
      ],
    },
  };

  let cli: TestCLI | null = null;

  afterEach(async () => {
    if (cli) {
      await cli.stop();
      cli = null;
    }
    jest.resetAllMocks();
  });

  describe('test', () => {
    it('finds dependencies in rpm sqlite databases', async () => {
      cli = await startSnykCLI(
        'container test amazonlinux:2022.0.20220504.1 --print-deps',
      );
      await expect(cli).toDisplay(`yum @ 4.9.0`, { timeout: 60 * 1000 });
    });

    it('finds dependencies in rpm ndb databases', async () => {
      const { code, stdout } = await runSnykCLI(
        `container test test/fixtures/container-projects/sle15.6.tar --json`,
      );
      const jsonOutput = JSON.parse(stdout);

      expect(jsonOutput.ok).toEqual(false);
      expect(jsonOutput.dependencyCount).toBe(139);
      expect(code).toEqual(1);
    });

    it('finds dependencies in wolfi/chainguard image', async () => {
      const { stdout } = await runSnykCLI(
        `container test chainguard/wolfi-base:latest --json`,
      );
      const jsonOutput = JSON.parse(stdout);
      expect(jsonOutput.dependencyCount).toBeGreaterThan(0);
    });

    it('container tests the platform specified in the parameters', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test debian:unstable-slim --platform=linux/arm64/v8`,
      );

      assertCliExitCode(code, 1, stderr);
      expect(stdout).toContain('Platform:          linux/arm64');
    });

    it('container test scan when the archive type is not specified in the .tar path prefix', async () => {
      const { code, stdout } = await runSnykCLI(
        `container test test/fixtures/container-projects/os-packages-and-app-vulns.tar --json`,
      );
      const jsonOutput = JSON.parse(stdout);

      expect(jsonOutput.ok).toEqual(false);
      expect(jsonOutput.uniqueCount).toBeGreaterThan(0);
      expect(code).toEqual(1);
    }, 30000);

    it('detects stripped Go binaries and reports fleet-server dependencies', async () => {
      const { code, stdout } = await runSnykCLI(
        `container test docker-archive:test/fixtures/container-projects/stripped-go-binaries-minimal.tar.gz --json`,
      );
      const jsonOutput = JSON.parse(stdout);

      const goModulesResults = jsonOutput.applications?.find((app) =>
        app.targetFile?.includes('fleet-server'),
      );
      expect(code).toEqual(1);
      expect(goModulesResults).toBeDefined();
    });

    it('should correctly scan an OCI image with manifest missing platform field', async () => {
      const image = 'snykgoof/oci-goof:ociNoPlatformTag';
      const { code, stdout } = await runSnykCLI(
        `container test ${image} --json`,
      );
      const jsonOutput = JSON.parse(stdout);
      expect(code).toEqual(1);
      expect(jsonOutput).toBeDefined();
      expect(jsonOutput.vulnerabilities).toBeDefined();
      expect(Array.isArray(jsonOutput.vulnerabilities)).toBe(true);
    }, 180000);

    it('npm depGraph is generated in an npm image with lockfiles', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test docker-archive:test/fixtures/container-projects/npm7-with-package-lock-file.tar --print-deps`,
      );

      assertCliExitCode(code, 1, stderr);
      expect(stdout).toContain('Package manager:   npm');
    });

    it('npm depGraph is generated in an npm image without package-lock.json file', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test docker-archive:test/fixtures/container-projects/npm7-without-package-lock-file.tar --print-deps`,
      );

      assertCliExitCode(code, 1, stderr);
      expect(stdout).toContain('Package manager:   npm');
    });

    it('npm depGraph is generated in an npm image without package-lock.json and package.json file', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test docker-archive:test/fixtures/container-projects/npm7-without-package-and-lock-file.tar --print-deps`,
      );

      assertCliExitCode(code, 1, stderr);
      expect(stdout).toContain('Package manager:   npm');
    });

    it('npm projects target file are found in container image', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test docker-archive:test/fixtures/container-projects//multi-project-image.tar`,
      );

      assertCliExitCode(code, 1, stderr);
      expect(stdout).toContain('Target file:       /usr/goof2/package.json');
      expect(stdout).toContain('Target file:       /usr/goof3/node_modules');
      expect(stdout).toContain('Target file:       /usr/goof/package.json');
      expect(stdout).toContain(
        'Target file:       /usr/local/lib/node_modules',
      );
    });

    it('npm depGraph is generated in an npm image with lockfiles image', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test docker-archive:test/fixtures/container-projects/npm7-without-package-lock-file.tar --print-deps`,
      );

      assertCliExitCode(code, 1, stderr);
      expect(stdout).toContain('Package manager:   npm');
    });

    it('pnpm depGraph is generated in an image with pnpm-lock.yaml v6', async () => {
      const { code, stdout } = await runSnykCLIWithDebug(
        `container test docker-archive:test/fixtures/container-projects/pnpmlockv6.tar --print-deps`,
      );

      // Exit code can be 0 (no vulns) or 1 (vulns found), both are valid
      expect([0, 1]).toContain(code);
      expect(stdout).toContain('Package manager:   pnpm');
    });

    it('pnpm depGraph is generated in an image with pnpm-lock.yaml v9', async () => {
      const { code, stdout } = await runSnykCLIWithDebug(
        `container test docker-archive:test/fixtures/container-projects/pnpmlockv9.tar --print-deps`,
      );

      // Exit code can be 0 (no vulns) or 1 (vulns found), both are valid
      expect([0, 1]).toContain(code);
      expect(stdout).toContain('Package manager:   pnpm');
    });

    it('pnpm project target file is found in container image', async () => {
      const { code, stdout } = await runSnykCLI(
        `container test docker-archive:test/fixtures/container-projects/pnpmlockv6.tar --json`,
      );
      const jsonOutput = JSON.parse(stdout);

      // Exit code can be 0 (no vulns) or 1 (vulns found), both are valid
      expect([0, 1]).toContain(code);
      expect(jsonOutput.applications).toBeDefined();
      expect(jsonOutput.applications.length).toBeGreaterThanOrEqual(1);

      const pnpmApp = jsonOutput.applications.find(
        (app) => app.packageManager === 'pnpm',
      );
      expect(pnpmApp).toBeDefined();
      expect(pnpmApp.targetFile).toContain('package.json');
    });

    it('finds dependencies in oci image (library/ubuntu)', async () => {
      cli = await startSnykCLI(
        'container test library/ubuntu@sha256:7a57c69fe1e9d5b97c5fe649849e79f2cfc3bf11d10bbd5218b4eb61716aebe6 --print-deps',
      );
      await expect(cli).toDisplay(`coreutils @ 8.32-4.1ubuntu1`, {
        timeout: 60 * 1000,
      });
    });

    it('prints dep graph with --print-graph flag', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container test --print-graph docker-archive:test/fixtures/container-projects/multi-project-image.tar`,
      );

      assertCliExitCode(code, 0, stderr);

      expect(stdout).toContain('DepGraph data:');
      expect(stdout).toContain(
        `DepGraph target:
docker-image|multi-project-image.tar
DepGraph end`,
      );

      const payloads = stdout
        .split('DepGraph data:')
        .slice(1)
        .map((payload) =>
          payload
            .split('DepGraph target:')
            .map((str) => str.replace('DepGraph end', '').trim()),
        );

      expect(payloads).toMatchSnapshot();
    });

    it('includes OS field with prettyName under docker element in JSON output for container tests when OS info is available', async () => {
      const { stdout } = await runSnykCLI(
        `container test library/ubuntu@sha256:7a57c69fe1e9d5b97c5fe649849e79f2cfc3bf11d10bbd5218b4eb61716aebe6 --json`,
      );
      const jsonOutput = JSON.parse(stdout);
      expect(jsonOutput.docker).toBeDefined();
      expect(jsonOutput.docker.os).toBeDefined();
      expect(jsonOutput.docker.os.prettyName).toBeDefined();
      expect(jsonOutput.docker.os.prettyName).toBe('Ubuntu 22.04.2 LTS');
    });

    it('successfully scans a local docker image with private tag', async () => {
      if (os.platform() === 'darwin') {
        console.warn(
          'Skipping container test - Docker not available on macOS CI',
        );
        return;
      }

      const tarPath = 'test/fixtures/container-projects/node-slim-image.tar';
      const privateTag = 'private-registry.local/test-node-slim:latest';
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

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

        // Validate the scan was successful (exit code 0 or 1 are both valid - 1 means vulns found)
        expect([0, 1]).toContain(code);

        let jsonOutput;
        try {
          jsonOutput = JSON.parse(stdout);
        } catch (e) {
          throw new Error(`Failed to parse JSON output: ${e.message}.`);
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
      if (os.platform() === 'darwin') {
        console.warn(
          'Skipping container test - Docker not available on macOS CI',
        );
        return;
      }

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Build the test image from the Dockerfile with large ELF file
      const dockerfilePath =
        'test/fixtures/container-projects/Dockerfile-large-elf-vulns';
      const testImageName = 'snyk-test-large-elf:latest';

      try {
        console.log('Building test image with large ELF file...');
        const buildResult = await execAsync(
          `docker build -f ${dockerfilePath} -t ${testImageName} test/fixtures/container-projects/`,
        );

        console.log('Docker build completed:', buildResult.stdout);

        // Run snyk container test on the built image
        console.log('Running snyk container test...');
        const { code, stdout, stderr } = await runSnykCLI(
          `container test ${testImageName} --json`,
        );

        // The test should complete without throwing errors
        // We expect to find vulnerabilities with alpine:3.10.1, so exit code should be 1
        expect(code).toBe(1);

        // Parse and validate JSON output
        let jsonOutput;
        try {
          jsonOutput = JSON.parse(stdout);
        } catch (e) {
          throw new Error(
            `Failed to parse JSON output: ${e.message}. Output: ${stdout}`,
          );
        }

        // Verify the scan completed successfully
        expect(jsonOutput).toBeDefined();
        expect(jsonOutput.packageManager).toBeDefined();

        // Verify no errors occurred - any error should cause test failure
        if (stderr && stderr.trim()) {
          throw new Error(
            `Unexpected errors during container scan:\n${stderr}`,
          );
        }

        console.log(
          'Container test completed successfully with large ELF file',
        );
      } finally {
        // Cleanup: remove the test image
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
    }, 300000); // 5 minute timeout for this test

    it('successfully scans image with empty history array', async () => {
      const { code, stdout, stderr } = await runSnykCLI(
        `container test public.ecr.aws/bottlerocket/bottlerocket-kernel-kit:v4.5.1 --json`,
      );

      const jsonOutput = JSON.parse(stdout);
      expect([0, 1]).toContain(code);

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput.packageManager).toBeDefined();

      expect(stderr).not.toContain('Cannot read properties of undefined');
      expect(stderr).not.toContain("reading 'created'");
    });
  });

  describe('depgraph', () => {
    it('should print depgraph for image as JSON', async () => {
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container depgraph ${TEST_DISTROLESS_STATIC_IMAGE}`,
      );

      assertCliExitCode(code, 0, stderr);

      let depgraph;
      expect(() => {
        depgraph = JSON.parse(stdout);
      }).not.toThrow();
      expect(depgraph).toMatchObject(TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH);
    });
  });

  describe('sbom (mock export-sbom service)', () => {
    let server: FakeServer;
    let env: Record<string, string>;

    beforeAll((done) => {
      const port = process.env.PORT || process.env.SNYK_PORT || '58584';
      const baseApi = '/api/v1';
      env = {
        ...process.env,
        SNYK_API: 'http://localhost:' + port + baseApi,
        SNYK_TOKEN: '123456789',
        SNYK_DISABLE_ANALYTICS: '1',
      };
      server = fakeServer(baseApi, env.SNYK_TOKEN);
      server.listen(port, () => {
        done();
      });
    });

    afterEach(() => {
      server.restore();
    });

    afterAll((done) => {
      server.close(() => {
        done();
      });
    });

    it('should print sbom for image - spdx', async () => {
      // return a dep-graph fixture from `/test-dependencies` endpoint
      server.setCustomResponse({
        result: {
          issues: [],
          issuesData: {},
          depGraphData: TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH,
        },
        meta: { org: 'test-org', isPublic: false },
      });
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=spdx2.3+json ${TEST_DISTROLESS_STATIC_IMAGE}`,
        { env },
      );

      let sbom;
      assertCliExitCode(code, 0, stderr);

      expect(() => {
        sbom = JSON.parse(stdout);
      }).not.toThrow();
      expect(sbom.name).toEqual('gcr.io/distroless/static');
      expect(sbom.spdxVersion).toEqual('SPDX-2.3');
      expect(sbom.packages).toHaveLength(
        TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH.pkgs.length,
      );
    });

    it('should print sbom for image - cyclonedx 1.4', async () => {
      // return a dep-graph fixture from `/test-dependencies` endpoint
      server.setCustomResponse({
        result: {
          issues: [],
          issuesData: {},
          depGraphData: TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH,
        },
        meta: { org: 'test-org', isPublic: false },
      });
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=cyclonedx1.4+json ${TEST_DISTROLESS_STATIC_IMAGE}`,
        { env },
      );

      let sbom: any;
      assertCliExitCode(code, 0, stderr);

      expect(() => {
        sbom = JSON.parse(stdout);
      }).not.toThrow();

      expect(sbom.specVersion).toEqual('1.4');
      expect(sbom['$schema']).toEqual(
        'http://cyclonedx.org/schema/bom-1.4.schema.json',
      );

      expect(sbom.components).toHaveLength(
        TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH.pkgs.length,
      );
    });

    it('should print sbom for image - cyclonedx 1.5', async () => {
      // return a dep-graph fixture from `/test-dependencies` endpoint
      server.setCustomResponse({
        result: {
          issues: [],
          issuesData: {},
          depGraphData: TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH,
        },
        meta: { org: 'test-org', isPublic: false },
      });
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=cyclonedx1.5+json ${TEST_DISTROLESS_STATIC_IMAGE}`,
        { env },
      );

      let sbom: any;
      assertCliExitCode(code, 0, stderr);

      expect(() => {
        sbom = JSON.parse(stdout);
      }).not.toThrow();

      expect(sbom.specVersion).toEqual('1.5');
      expect(sbom['$schema']).toEqual(
        'http://cyclonedx.org/schema/bom-1.5.schema.json',
      );

      expect(sbom.components).toHaveLength(
        TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH.pkgs.length,
      );
    });

    it('should print sbom for image - cyclonedx 1.6', async () => {
      // return a dep-graph fixture from `/test-dependencies` endpoint
      server.setCustomResponse({
        result: {
          issues: [],
          issuesData: {},
          depGraphData: TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH,
        },
        meta: { org: 'test-org', isPublic: false },
      });
      const { code, stdout, stderr } = await runSnykCLIWithDebug(
        `container sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=cyclonedx1.6+json ${TEST_DISTROLESS_STATIC_IMAGE}`,
        { env },
      );

      let sbom: any;
      assertCliExitCode(code, 0, stderr);

      expect(() => {
        sbom = JSON.parse(stdout);
      }).not.toThrow();

      expect(sbom.specVersion).toEqual('1.6');
      expect(sbom['$schema']).toEqual(
        'http://cyclonedx.org/schema/bom-1.6.schema.json',
      );

      expect(sbom.components).toHaveLength(
        TEST_DISTROLESS_STATIC_IMAGE_DEPGRAPH.pkgs.length,
      );
    });

    it('finds go binaries on windows with complex paths', async () => {
      const { code, stdout } = await runSnykCLI(
        'container test test/fixtures/container-projects/go-binaries.tar --json',
        { env },
      );

      const jsonOutput = JSON.parse(stdout);

      // Should succeed and find Go binaries (including esbuild)
      expect([0, 1]).toContain(code); // 0 = no vulns, 1 = vulns found
      expect(jsonOutput).toHaveProperty('applications');
      expect(jsonOutput.applications).toBeInstanceOf(Array);
      expect(jsonOutput.applications.length).toBeGreaterThanOrEqual(1);

      // Verify esbuild binary was actually detected by the real container scan
      const esbuildApp = jsonOutput.applications.find(
        (app) => app.targetFile && app.targetFile.includes('esbuild'),
      );
      expect(esbuildApp).toBeDefined();
      expect(esbuildApp.targetFile).toBe(
        '/app/node_modules/.pnpm/@esbuild+linux-x64@0.23.1/node_modules/@esbuild/linux-x64/bin/esbuild',
      );

      // Verify the complex pnpm path structure is handled correctly
      expect(esbuildApp.targetFile).toMatch(/@esbuild\+linux-x64@0\.23\.1/);
      expect(esbuildApp.targetFile).toContain('.pnpm');
      expect(esbuildApp.targetFile).toContain('node_modules');
      expect(esbuildApp.packageManager).toBe('gomodules');
    });
  });

  describe('snyk container monitor --json output', () => {
    it('snyk container monitor json produces expected output for a single depgraph', async () => {
      const { code, stdout } = await runSnykCLI(
        `container monitor --platform=linux/amd64 --json ${TEST_DISTROLESS_STATIC_IMAGE}`,
      );
      expect(code).toEqual(0);
      const result = JSON.parse(stdout);
      expect(result).toEqual(
        expect.objectContaining({
          ok: true,
          packageManager: 'deb',
          manageUrl: expect.stringContaining('://'),
          scanResult: expect.objectContaining({
            facts: expect.arrayContaining([
              expect.objectContaining({
                type: 'depGraph',
                data: expect.objectContaining({
                  pkgManager: expect.objectContaining({
                    name: 'deb',
                    repositories: expect.arrayContaining([
                      expect.objectContaining({
                        alias: 'debian:11',
                      }),
                    ]),
                  }),
                }),
              }),
            ]),
          }),
        }),
      );
    });

    it('snyk container monitor json produces expected output for multiple depgraphs', async () => {
      const { code, stdout } = await runSnykCLI(
        `container monitor --platform=linux/amd64 --json snyk/snyk:linux`,
      );
      expect(code).toEqual(0);
      const result = JSON.parse(stdout);
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ok: true,
            packageManager: 'deb',
            manageUrl: expect.stringContaining('://'),
            scanResult: expect.objectContaining({
              facts: expect.arrayContaining([
                expect.objectContaining({
                  type: 'depGraph',
                  data: expect.objectContaining({
                    pkgManager: expect.objectContaining({
                      name: 'deb',
                      repositories: expect.arrayContaining([
                        expect.objectContaining({
                          alias: 'ubuntu:24.04',
                        }),
                      ]),
                    }),
                  }),
                }),
              ]),
            }),
          }),
          expect.objectContaining({
            ok: true,
            packageManager: 'gomodules',
            manageUrl: expect.stringContaining('://'),
            scanResult: expect.objectContaining({
              facts: expect.arrayContaining([
                expect.objectContaining({
                  type: 'depGraph',
                  data: expect.objectContaining({
                    pkgManager: expect.objectContaining({
                      name: 'gomodules',
                    }),
                  }),
                }),
              ]),
            }),
          }),
        ]),
      );
    });
  });

  describe('snyk container monitor supports --target-reference', () => {
    let server: ReturnType<typeof fakeServer>;
    let env: Record<string, string>;

    beforeAll((done) => {
      const port = getServerPort(process);
      const baseApi = '/api/v1';
      env = {
        ...process.env,
        SNYK_API: 'http://localhost:' + port + baseApi,
        SNYK_HOST: 'http://localhost:' + port,
        SNYK_TOKEN: '123456789',
        SNYK_DISABLE_ANALYTICS: '1',
        DEBUG: 'snyk*',
      };
      server = fakeServer(baseApi, env.SNYK_TOKEN);
      server.listen(port, () => {
        done();
      });
    });

    afterEach(() => {
      server.restore();
    });

    afterAll((done) => {
      server.close(() => done());
    });

    it('forwards value of target-reference to monitor-dependencies endpoint', async () => {
      const { code } = await runSnykCLI(
        `container monitor ${TEST_DISTROLESS_STATIC_IMAGE} --target-reference=test-target-ref`,
        {
          env,
        },
      );
      expect(code).toEqual(0);

      const monitorRequests = server
        .getRequests()
        .filter((request) => request.url?.includes('/monitor-dependencies'));

      expect(monitorRequests.length).toBeGreaterThanOrEqual(1);
      monitorRequests.forEach((request) => {
        expect(request.body.scanResult.targetReference).toBe('test-target-ref');
      });
    });
  });

  function assertCliExitCode(
    code: number,
    expectedCode: number,
    stderr: string,
  ) {
    try {
      expect(code).toEqual(expectedCode);
    } catch (e) {
      throw new Error(`${e.message}\n\nCLI stderr:\n${stderr}`);
    }
  }

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
