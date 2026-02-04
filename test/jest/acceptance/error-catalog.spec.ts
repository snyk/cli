import { runSnykCLI } from '../util/runSnykCLI';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { createProject } from '../util/createProject';
import { getServerPort } from '../util/getServerPort';
import {
  isWindowsOperatingSystem,
  testIf,
  makeTmpDirectory,
} from '../../utils';
import { CLI } from '@snyk/error-catalog-nodejs-public';
import * as fs from 'fs';

const TEST_DISTROLESS_STATIC_IMAGE =
  'gcr.io/distroless/static@sha256:7198a357ff3a8ef750b041324873960cf2153c11cc50abb9d8d5f8bb089f6b4e';

const TEST_WINDOWS_AMD64_IMAGE =
  'mcr.microsoft.com/windows/nanoserver:ltsc2019';

interface Workflow {
  type: string;
  cmd: string;
}

const integrationWorkflows: Workflow[] = [
  {
    type: 'typescript',
    cmd: 'test',
  },
  {
    type: 'golang/native',
    cmd: 'code test',
  },
  {
    type: 'typescript',
    cmd: 'monitor',
  },
];

// Use a different image for Windows as the distroless image is not available on Windows
if (isWindowsOperatingSystem()) {
  integrationWorkflows.push({
    type: 'typescript',
    cmd: `container monitor ${TEST_WINDOWS_AMD64_IMAGE}`,
  });
} else {
  integrationWorkflows.push({
    type: 'typescript',
    cmd: `container monitor ${TEST_DISTROLESS_STATIC_IMAGE}`,
  });
}

const snykOrg = '11111111-2222-3333-4444-555555555555';

describe.each(integrationWorkflows)(
  'outputs Error Catalog errors',
  ({ cmd, type }) => {
    let env: { [key: string]: string | undefined } = {
      ...process.env,
    };

    describe('authentication errors', () => {
      if (isWindowsOperatingSystem()) {
        // Address as part CLI-1202
        return;
      }
      describe(`${type} workflow`, () => {
        it(`snyk ${cmd}`, async () => {
          const { code, stdout } = await runSnykCLI(cmd, {
            env: {
              ...env,
              SNYK_TOKEN: '1234',
            },
          });

          expect(code).toBe(2);
          expect(stdout).toContain('Authentication error (SNYK-0005)');
          expect(stdout).toContain(`urn:snyk:interaction`);
        });
      });
    });

    describe('other network errors', () => {
      let server: ReturnType<typeof fakeServer>;
      const ipAddr = getFirstIPv4Address();
      const port = getServerPort(process);
      const baseApi = '/api/v1';
      beforeAll((done) => {
        env = {
          ...env,
          SNYK_API: 'http://' + ipAddr + ':' + port + baseApi,
          SNYK_HOST: 'http://' + ipAddr + ':' + port,
          SNYK_TOKEN: '123456789',
          SNYK_HTTP_PROTOCOL_UPGRADE: '0',
          SNYK_CFG_ORG: snykOrg,
        };
        server = fakeServer(baseApi, 'snykToken');
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

      describe('internal server errors', () => {
        describe(`${type} workflow`, () => {
          it(`snyk ${cmd}`, async () => {
            const localEnv = {
              ...env,
              INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '1', // reduce test duration by reducing retry
              INTERNAL_NETWORK_REQUEST_RETRY_AFTER_SECONDS: '1', // reduce test duration by reducing retry
            };

            server.setStatusCode(500);
            const { code } = await runSnykCLI(`${cmd}`, { env: localEnv });
            const analyticsRequest = server
              .getRequests()
              .filter((value) =>
                value.url.includes(`/api/hidden/orgs/${snykOrg}/analytics`),
              )
              .pop();
            const errors =
              analyticsRequest?.body.data.attributes.interaction.errors;

            expect(code).toBe(2);
            expect(errors[0].code).toEqual('500');
          }, 50000);
        });
      });

      describe('bad request errors', () => {
        describe(`${type} workflow`, () => {
          it(`snyk ${cmd}`, async () => {
            server.setStatusCode(400);
            const { code } = await runSnykCLI(`${cmd}`, { env });
            const analyticsRequest = server
              .getRequests()
              .filter((value) =>
                value.url.includes(`/api/hidden/orgs/${snykOrg}/analytics`),
              )
              .pop();
            const errors =
              analyticsRequest?.body.data.attributes.interaction.errors;

            expect(code).toBe(2);
            expect(errors[0].code).toEqual('400');
          });
        });
      });
    });
  },
);

describe('special error cases', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(async () => {
    const ipAddr = getFirstIPv4Address();
    const port = getServerPort(process);
    const baseApi = '/api/v1';

    env = {
      ...process.env,
      SNYK_API: 'http://' + ipAddr + ':' + port + baseApi,
      SNYK_TOKEN: '123456789',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      SNYK_CFG_ORG: snykOrg,
      INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '1', // reduce test duration by reducing retry
      INTERNAL_NETWORK_REQUEST_RETRY_AFTER_SECONDS: '1', // reduce test duration by reducing retry
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        resolve();
      });
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  // Address as part CLI-1202
  testIf(!isWindowsOperatingSystem())(
    'Monitor 422 error handling',
    async () => {
      const endpoint = `/api/v1/monitor-dependencies?org=${snykOrg}`;
      const expectedCode = 422;
      const expectedMessage =
        'Validation failed: missing required field "docker.baseImage"';
      // Set up the 422 error response
      server.setEndpointResponse(endpoint, {
        message: expectedMessage,
      });
      server.setEndpointStatusCode(endpoint, expectedCode);

      const { code, stdout } = await runSnykCLI(
        `container monitor alpine:latest -d`,
        {
          env: env,
        },
      );

      expect(code).toBeGreaterThan(1);

      const analyticsRequest = server
        .getRequests()
        .filter((value) =>
          value.url.includes(`/api/hidden/orgs/${snykOrg}/analytics`),
        )
        .pop();
      const errors = analyticsRequest?.body.data.attributes.interaction.errors;

      expect(errors[0].code).toEqual(expectedCode.toString());
      expect(stdout).toContain(expectedMessage);
      expect(stdout).toContain(
        new CLI.GeneralCLIFailureError('').metadata.errorCode,
      );
    },
  );

  testIf(!isWindowsOperatingSystem())(
    'test command returns SNYK-CLI-0008 when no supported files are found',
    async () => {
      // Create a temporary empty directory
      const emptyDir = await makeTmpDirectory();

      try {
        const { code, stdout, stderr } = await runSnykCLI(`test`, {
          cwd: emptyDir,
          env: env,
        });

        // Should exit with code 3 (NO_SUPPORTED_PROJECTS_DETECTED)
        expect(code).toBe(3);

        // Should contain the error code SNYK-CLI-0008
        expect(stdout).toContain('SNYK-CLI-0008');
        expect(stdout).toContain('No supported files found');
        expect(stderr).toBe('');
      } finally {
        // Clean up temporary directory
        await fs.promises.rm(emptyDir, { recursive: true, force: true });
      }
    },
  );


  testIf(!isWindowsOperatingSystem())(
    'sbom command returns SNYK-CLI-0006 when authentication is missing',
    async () => {
      // Create a temporary directory with a valid npm project
      const project = await createProject('npm-bundled-dep');
      
      // Configure fake server to return 401 (authentication failure)
      server.setStatusCode(401);
      
      delete env.SNYK_TOKEN;
      delete env.SNYK_CFG_ORG;  //dont set the org to ensure the error is returned

      const { code, stdout, stderr } = await runSnykCLI(
        `sbom --format cyclonedx1.4+json --debug`,
        {
          cwd: project.path(),
          env: env,
        },
      );
  

      console.log(stderr);
      // expect exit with code 2 (authentication/authorization failure)
      expect(code).toBe(2);
      // expect the error code SNYK-0005 and SNYK-CLI-0006 to pass
      expect(stderr).toContain('SNYK-0005');
      expect(stderr).not.toContain('SNYK-CLI-0000');
      expect(stderr).toContain('SNYK-CLI-0006');
    },
  );
});
