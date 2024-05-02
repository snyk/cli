import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import { matchers } from 'jest-json-schema';

const stripAnsi = require('strip-ansi');

expect.extend(matchers);

const SARIF_SCHEMA = require('../../../fixtures/snyk-code/sarif-schema.json');
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ACTION_NEEDED = 1;
const EXIT_CODE_NO_SUPPORTED_FILES = 3;

describe('snyk code test', () => {
  let server: ReturnType<typeof fakeServer>;
  let deepCodeServer: ReturnType<typeof fakeDeepCodeServer>;
  let env: Record<string, string>;
  const port = getServerPort(process);
  const baseApi = '/api/v1';
  const initialEnvVars = {
    ...process.env,
    SNYK_API: 'http://localhost:' + port + baseApi,
    SNYK_HOST: 'http://localhost:' + port,
    SNYK_TOKEN: '123456789',
  };

  beforeAll((done) => {
    deepCodeServer = fakeDeepCodeServer();
    deepCodeServer.listen(() => {});
    env = {
      ...initialEnvVars,
      SNYK_CODE_CLIENT_PROXY_URL: `http://localhost:${deepCodeServer.getPort()}`,
    };
    server = fakeServer(baseApi, 'snykToken');
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
    deepCodeServer.restore();
  });

  afterAll((done) => {
    deepCodeServer.close(() => {});
    server.close(() => {
      done();
    });
  });

  interface Workflow {
    type: string;
    env: { [key: string]: string | undefined };
  }

  const userJourneyWorkflows: Workflow[] = [
    {
      type: 'legacy',
      env: {
        ...process.env,
        INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'false',
      },
    },
    // TODO: test once Go based snyk code is implemented
    // {
    //   type: 'native',
    //   env: {
    //     ...process.env,
    //     // internal GAF feature flag for consistent ignores
    //     INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'true',
    //   },
    // }
  ];

  jest.setTimeout(60000);
  describe.each(userJourneyWorkflows)('user journey', ({ type, env }) => {
    describe(`${type} workflow`, () => {
      it('should fail - when we do not support files', async () => {
        const { path } = await createProjectFromFixture('empty');

        const { stdout, code, stderr } = await runSnykCLI(
          `code test ${path()}`,
          {
            env,
          },
        );

        if (stderr) console.log('STDERR: ', stderr);

        expect(stderr).toBe('');
        expect(stdout).toContain(`We found 0 supported files`);
        expect(code).toBe(EXIT_CODE_NO_SUPPORTED_FILES); // failure, no supported projects detected
      });

      it('should succeed - when no errors found', async () => {
        const { path } = await createProjectFromFixture(
          'sast-empty/shallow_empty',
        );

        const { stdout, code, stderr } = await runSnykCLI(
          `code test ${path()}`,
          {
            env,
          },
        );

        if (stderr) console.log('STDERR: ', stderr);

        expect(stderr).toBe('');
        expect(stdout).toContain(`Awesome! No issues were found.`);
        expect(code).toBe(EXIT_CODE_SUCCESS);
      });

      it('should succeed - with correct exit code', async () => {
        const { path } = await createProjectFromFixture(
          'sast/shallow_sast_webgoat',
        );

        const { stdout, stderr, code } = await runSnykCLI(
          `code test ${path()}`,
          {
            env,
          },
        );

        if (stderr) console.log('STDERR: ', stderr);

        // We do not render the help message for unknown flags
        expect(stderr).toBe('');
        expect(stripAnsi(stdout)).toContain('45 Code issues found');
        expect(stripAnsi(stdout)).toContain(
          '24 [High]   4 [Medium]   17 [Low]',
        );
        expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
      });

      it.each([['sarif'], ['json']])(
        '--%s output should match sarif schema',
        async (option) => {
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );

          const { stdout, stderr, code } = await runSnykCLI(
            `code test ${path()} --${option}`,
            {
              env,
            },
          );

          if (stderr) console.log('STDERR: ', stderr);

          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);

          const jsonOutput = JSON.parse(stdout);
          expect(jsonOutput).toMatchSchema(SARIF_SCHEMA);
        },
      );
    });
  });
});
