import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';
import { runSnykCLI } from '../util/runSnykCLI';
import { fakeServer } from '../../acceptance/fake-server';
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

    describe('authorization errors', () => {
      describe(`${type} workflow`, () => {
        it(`snyk ${cmd}`, async () => {
          await runSnykCLI('config clear');
          const { code, stdout } = await runSnykCLI(cmd, { env });

          expect(code).toBe(2);
          expect(stdout).toContain('Authentication error (SNYK-0005)');
        });
      });
    });

    // TODO: fix fake server proxy config
    describe.skip('internal server errors', () => {
      let server: ReturnType<typeof fakeServer>;
      const port = getServerPort(process);
      beforeEach((done) => {
        server = fakeServer('/', 'snykToken');
        server.listen(port, () => {
          done();
        });
      });
      afterEach((done) => {
        server.restore();
        server.close(() => {
          done();
        });
      });

      describe(`${type} workflow`, () => {
        it.only(`snyk ${cmd}`, async () => {
          server.setStatusCode(500);
          const { code, stdout, stderr } = await runSnykCLI(`${cmd} -d`, {
            env: {
              ...env,
              SNYK_API: 'http://localhost:' + port,
              SNYK_TOKEN: '123456789',
            },
          });
          console.log(stderr);
          expect(code).toBe(2);
          expect(stdout).toContain(
            'Request not fulfilled due to server error (SNYK-9999)',
          );
        });
      });
    });

    // TODO: fix fake server proxy config
    describe.skip('bad request errors', () => {
      describe(`${type} workflow`, () => {
        it.only(`snyk ${cmd}`, async () => {
          const { code, stdout } = await runSnykCLI(`test`, { env });
          expect(code).toBe(2);
          expect(stdout).toContain('Authentication error (SNYK-0005)');
        });
      });
    });
  },
);
