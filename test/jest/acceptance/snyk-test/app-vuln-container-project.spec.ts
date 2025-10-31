import * as path from 'path';
import { fakeServer } from '../../../acceptance/fake-server';
import { runSnykCLI } from '../../util/runSnykCLI';
import { getServerPort } from '../../util/getServerPort';
import { isWindowsOperatingSystem, testIf } from '../../../utils';

describe('container test projects behavior with --app-vulns, --file and --exclude-base-image-vulns flags', () => {
  it('should find nothing when only vulns are in base image', async () => {
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/os-app-alpine-and-debug.tar --exclude-app-vulns --json --exclude-base-image-vulns`,
    );

    const jsonOutput = JSON.parse(stdout);
    expect(jsonOutput.ok).toEqual(true);
    expect(code).toEqual(0);
  }, 60000);
  it('should find all vulns including app vulns', async () => {
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/os-packages-and-app-vulns.tar --json --experimental`,
    );
    const jsonOutput = JSON.parse(stdout);

    expect(jsonOutput[0].ok).toEqual(false);
    expect(jsonOutput[0].uniqueCount).toBeGreaterThan(0);
    expect(jsonOutput[1].ok).toEqual(false);
    expect(jsonOutput[1].uniqueCount).toBeGreaterThan(0);
    expect(code).toEqual(1);
  }, 60000);
  it('should find nothing when app-vulns are explicitly disabled', async () => {
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/os-packages-and-app-vulns.tar --json --exclude-app-vulns`,
    );
    const jsonOutput = JSON.parse(stdout);
    expect(Array.isArray(jsonOutput)).toBeFalsy();
    expect(jsonOutput.applications).toBeUndefined();
    expect(jsonOutput.ok).toEqual(false);
    expect(jsonOutput.uniqueCount).toBeGreaterThan(0);
    expect(code).toEqual(1);
  }, 60000);
  it('should find nothing on conflicting app-vulns flags', async () => {
    // if both flags are set, --exclude-app-vulns should take precedence and
    // disable it.
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/os-packages-and-app-vulns.tar --json --app-vulns --exclude-app-vulns --experimental`,
    );
    const jsonOutput = JSON.parse(stdout);
    expect(Array.isArray(jsonOutput)).toBeFalsy();
    expect(jsonOutput.ok).toEqual(false);
    expect(jsonOutput.uniqueCount).toBeGreaterThan(0);
    expect(code).toEqual(1);
  }, 60000);

  it('should find vulns on an npm project application image without package-lock.json file', async () => {
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/npm7-without-package-lock-file.tar --json --app-vulns`,
    );
    const jsonOutput = JSON.parse(stdout);
    expect(Array.isArray(jsonOutput)).toBeFalsy();
    expect(jsonOutput.uniqueCount).toBeGreaterThan(0);
    expect(code).toEqual(1);
  }, 60000);

  it('should find vulns on an npm project application image without package.json and package-lock.json file', async () => {
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/npm7-without-package-and-lock-file.tar --print-deps --app-vulns`,
    );
    expect(code).toEqual(1);
    expect(stdout).toContain('Package manager:   npm');
  }, 60000);

  it('should show app vulns tip when available', async () => {
    const { stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/os-packages-and-app-vulns.tar`,
    );

    expect(stdout).toContain(`Testing docker-archive:test`);
  }, 60000);

  it('should find all vulns without experimental flag', async () => {
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/os-packages-and-app-vulns.tar --json`,
    );
    const jsonOutput = JSON.parse(stdout);

    expect(jsonOutput.ok).toEqual(false);
    expect(jsonOutput.uniqueCount).toBeGreaterThan(0);
    const applications = jsonOutput.applications;
    expect(applications.length).toEqual(1);
    expect(applications[0].uniqueCount).toBeGreaterThan(0);
    expect(applications[0].ok).toEqual(false);
    expect(code).toEqual(1);
  }, 60000);
  it('should return only dockerfile instructions vulnerabilities when excluding base image vulns', async () => {
    const dockerfilePath = path.normalize(
      'test/fixtures/container-projects/Dockerfile-vulns',
    );

    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/os-packages-and-app-vulns.tar --exclude-app-vulns --json --file=${dockerfilePath} --exclude-base-image-vulns`,
    );
    const jsonOutput = JSON.parse(stdout);

    expect(jsonOutput.ok).toEqual(false);
    expect(jsonOutput.uniqueCount).toBeGreaterThan(0);
    expect(code).toEqual(1);
  }, 60000);

  it('finds dockerfile instructions and app vulns when excluding base image vulns', async () => {
    const dockerfilePath = path.normalize(
      'test/fixtures/container-projects/Dockerfile-vulns',
    );

    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/os-packages-and-app-vulns.tar --json --file=${dockerfilePath} --exclude-base-image-vulns`,
    );
    const jsonOutput = JSON.parse(stdout);

    expect(jsonOutput.ok).toEqual(false);
    expect(jsonOutput.uniqueCount).toBeGreaterThan(0);
    expect(jsonOutput.applications[0].ok).toEqual(false);
    expect(jsonOutput.applications[0].uniqueCount).toBeGreaterThan(0);
    expect(code).toEqual(1);
  }, 60000);
});

describe('container test projects behavior with --json flag', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_INTEGRATION_NAME: 'JENKINS',
      SNYK_INTEGRATION_VERSION: '1.2.3',
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

  // Address as part CLI-1200
  testIf(!isWindowsOperatingSystem())(
    'returns a json with the --experimental flags',
    async () => {
      const { code, stdout } = await runSnykCLI(
        `container test docker-archive:test/fixtures/container-projects/os-app-alpine-and-debug.tar --json --experimental`,
        {
          env,
        },
      );

      const jsonOutput = JSON.parse(stdout);
      expect(Array.isArray(jsonOutput)).toBeTruthy();
      expect(jsonOutput).toHaveLength(2);
      expect(code).toEqual(0);
    },
  );
});

describe('container test projects behavior with --exclude-node-modules flag', () => {
  // Dockerfile for node-slim-image.tar
  // FROM node:alpine

  // COPY package.json /goof1/
  // COPY package-lock.json /goof1/
  // COPY package.json /
  // COPY package-lock.json /
  // WORKDIR /goof1
  // RUN npm install
  // WORKDIR /
  // RUN npm install
  it('should scan npm projects only when package.json and package-lock.json pairs are identified in the container image', async () => {
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:test/fixtures/container-projects/node-slim-image.tar --exclude-node-modules --json --exclude-base-image-vulns`,
    );
    const jsonOutput = JSON.parse(stdout);
    const applications = jsonOutput.applications;

    expect(applications.length).toEqual(2);
    expect(code).toEqual(1);
  }, 60000);

  // Address as part CLI-1200
  testIf(!isWindowsOperatingSystem())(
    'should scan npm projects from package.json and package-lock.json pairs and node_modules dependencies',
    async () => {
      const { code, stdout } = await runSnykCLI(
        `container test docker-archive:test/fixtures/container-projects/node-slim-image.tar --json --exclude-base-image-vulns`,
      );
      const jsonOutput = JSON.parse(stdout);
      const applications = jsonOutput.applications;

      expect(applications.length).toEqual(3);

      expect(code).toEqual(1);
    },
    60000,
  );
});
