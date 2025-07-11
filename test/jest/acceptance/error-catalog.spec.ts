import { runSnykCLI } from '../util/runSnykCLI';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { getServerPort } from '../util/getServerPort';

const TEST_DISTROLESS_STATIC_IMAGE =
  'gcr.io/distroless/static@sha256:7198a357ff3a8ef750b041324873960cf2153c11cc50abb9d8d5f8bb089f6b4e';

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
  {
    type: 'typescript',
    cmd: `container monitor ${TEST_DISTROLESS_STATIC_IMAGE}`,
  },
];

describe.each(integrationWorkflows)(
  'outputs Error Catalog errors',
  ({ cmd, type }) => {
    const snykOrg = '11111111-2222-3333-4444-555555555555';
    let env: { [key: string]: string | undefined } = {
      ...process.env,
    };

    describe('authentication errors', () => {
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
          });
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
