import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';
import { runSnykCLI } from '../util/runSnykCLI';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { getServerPort } from '../util/getServerPort';

interface Workflow {
  type: string;
  cmd: string;
  env: { [key: string]: string | undefined };
}

const integrationWorkflows: Workflow[] = [
  {
    type: 'typescript',
    cmd: 'test',
    env: {
      INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'false',
    },
  },
  {
    type: 'typescript',
    cmd: 'test code',
    env: {
      INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'false',
    },
  },
  {
    type: 'golang/native',
    cmd: 'code test',
    env: {
      // internal GAF feature flag for consistent ignores
      INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'true',
    },
  },
];

describe.each(integrationWorkflows)(
  'outputs Error Catalog errors',
  ({ cmd, type, env }) => {
    let initialConfig: Record<string, string>;
    beforeEach(async () => {
      initialConfig = await getCliConfig();
      await runSnykCLI(`config clear`, { env });
    });
    afterEach(async () => {
      await restoreCliConfig(initialConfig);
    });

    describe('authentication errors', () => {
      describe(`${type} workflow`, () => {
        it(`snyk ${cmd}`, async () => {
          await runSnykCLI('config clear');
          const { code, stdout } = await runSnykCLI(cmd, { env });

          expect(code).toBe(2);
          expect(stdout).toContain('Authentication error (SNYK-0005)');
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
            server.setStatusCode(500)
            const { code, stdout } = await runSnykCLI(`${cmd}`, { env });
            expect(code).toBe(2);
            expect(stdout).toContain(
              'Request not fulfilled due to server error (SNYK-9999)',
            );
          });
        });
      });

      describe('bad request errors', () => {
        describe(`${type} workflow`, () => {
          it(`snyk ${cmd}`, async () => {
            server.setStatusCode(400)
            const { code, stdout } = await runSnykCLI(`${cmd}`, { env });
            expect(code).toBe(2);
            expect(stdout).toContain(
              'Client request cannot be processed (SNYK-0003)',
            );
          });
        });
      });
    });
  },
);
